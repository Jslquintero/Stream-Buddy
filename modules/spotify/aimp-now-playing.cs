using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public static class AimpNowPlaying
{
    // AIMP SDK Remote Control API (apiRemote.h).
    private const string RemoteClass = "AIMP2_RemoteInfo";
    private const uint CommandMessage = 0x475;
    private const uint PropertyMessage = 0x477;
    private const int PositionProperty = 0x20;
    private const int DurationProperty = 0x30;
    private const int StateProperty = 0x40;
    private const int GetAlbumArt = 29;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessageTimeout(
        IntPtr window, uint message, IntPtr wParam, IntPtr lParam,
        uint flags, uint timeout, out IntPtr result);

    public sealed class Track
    {
        internal IntPtr Window;
        public string Title { get; internal set; }
        public string Artist { get; internal set; }
        public long Duration { get; internal set; }
        public long Progress { get; internal set; }
        public bool Playing { get; internal set; }
    }

    private static long GetProperty(IntPtr window, int property)
    {
        IntPtr result;
        return SendMessageTimeout(window, PropertyMessage, new IntPtr(property),
            IntPtr.Zero, 2, 500, out result) == IntPtr.Zero ? -1 : result.ToInt64();
    }

    public static bool IsAvailable()
    {
        return FindWindow(RemoteClass, RemoteClass) != IntPtr.Zero;
    }

    public static Track Read()
    {
        IntPtr window = FindWindow(RemoteClass, RemoteClass);
        if (window == IntPtr.Zero) return null;
        long state = GetProperty(window, StateProperty);
        if (state != 1 && state != 2) return null;

        // Packed 88-byte header followed by six length-prefixed UTF-16 fields.
        const int headerSize = 88;
        const int lengthsStart = 40;
        byte[] data = new byte[2048];
        using (var map = MemoryMappedFile.OpenExisting(RemoteClass, MemoryMappedFileRights.Read))
        using (var view = map.CreateViewAccessor(0, data.Length, MemoryMappedFileAccess.Read))
            view.ReadArray(0, data, 0, data.Length);

        if (BitConverter.ToInt32(data, 4) == 0) return null;
        string[] fields = new string[6];
        int offset = headerSize;
        for (int i = 0; i < fields.Length; i++)
        {
            uint length = BitConverter.ToUInt32(data, lengthsStart + i * sizeof(uint));
            if (length > (data.Length - offset) / 2) return null;
            int bytes = (int)length * 2;
            fields[i] = Encoding.Unicode.GetString(data, offset, bytes).TrimEnd('\0');
            offset += bytes;
        }

        string title = fields[5];
        if (String.IsNullOrWhiteSpace(title))
            title = Path.GetFileNameWithoutExtension(fields[3]);
        if (String.IsNullOrWhiteSpace(title)) return null;

        long duration = GetProperty(window, DurationProperty);
        return new Track {
            Window = window,
            Title = title,
            Artist = fields[1],
            Duration = duration < 0 ? BitConverter.ToUInt32(data, 16) : duration,
            Progress = Math.Max(0, GetProperty(window, PositionProperty)),
            Playing = state == 2
        };
    }

    public static string ReadAlbumArt(Track track)
    {
        var receiver = new AlbumArtReceiver();
        receiver.CreateHandle(new CreateParams { Parent = new IntPtr(-3) });
        try
        {
            IntPtr result;
            SendMessageTimeout(track.Window, CommandMessage, new IntPtr(GetAlbumArt),
                receiver.Handle, 2, 1000, out result);
        }
        finally { receiver.DestroyHandle(); }
        byte[] png = receiver.Png;
        if (png == null) return "";
        if (png.Length <= 524288) return "data:image/png;base64," + Convert.ToBase64String(png);

        using (var input = new MemoryStream(png))
        using (var original = Image.FromStream(input))
        {
            double scale = Math.Min(1, 384.0 / Math.Max(original.Width, original.Height));
            int width = Math.Max(1, (int)Math.Round(original.Width * scale));
            int height = Math.Max(1, (int)Math.Round(original.Height * scale));
            using (var resized = new Bitmap(original, width, height))
            using (var output = new MemoryStream())
            {
                resized.Save(output, ImageFormat.Jpeg);
                return "data:image/jpeg;base64," + Convert.ToBase64String(output.ToArray());
            }
        }
    }

    private sealed class AlbumArtReceiver : NativeWindow
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct CopyData
        {
            public IntPtr Id;
            public int Size;
            public IntPtr Data;
        }

        public byte[] Png;

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x004A && message.LParam != IntPtr.Zero)
            {
                var payload = (CopyData)Marshal.PtrToStructure(message.LParam, typeof(CopyData));
                if (payload.Id.ToInt64() == 0x41495043 && payload.Data != IntPtr.Zero &&
                    payload.Size >= 8 && payload.Size <= 32 * 1024 * 1024 &&
                    Marshal.ReadInt64(payload.Data) == 0x0A1A0A0D474E5089L)
                {
                    Png = new byte[payload.Size];
                    Marshal.Copy(payload.Data, Png, 0, Png.Length);
                    message.Result = new IntPtr(1);
                    return;
                }
            }
            base.WndProc(ref message);
        }
    }
}
