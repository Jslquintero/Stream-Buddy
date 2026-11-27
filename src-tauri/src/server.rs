use std::{
    fs::{self, File},
    io::{self, BufRead, BufReader, Write},
    os::windows::{
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
        process::CommandExt,
    },
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
use windows_sys::Win32::System::{
    JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    },
    Threading::CREATE_NO_WINDOW,
};

pub const ADDRESS: &str = "127.0.0.1:17900";
pub const URL: &str = "http://127.0.0.1:17900";

pub struct Server {
    child: Child,
    job: Option<OwnedHandle>,
}

pub struct Installation {
    pub bin: PathBuf,
    pub app: PathBuf,
    pub local: PathBuf,
}

impl Installation {
    pub fn start(&self, import_from: Option<&Path>) -> Result<Server, String> {
        self.spawn(import_from).map_err(|error| error.to_string())
    }

    fn spawn(&self, import_from: Option<&Path>) -> io::Result<Server> {
        let job = create_job()?;
        let log = File::create(self.local.join("server.log"))?;
        let cache = self.local.join("cache");
        fs::create_dir_all(&cache)?;
        let mut command = Command::new(self.bin.join("node.exe"));
        command
            .creation_flags(CREATE_NO_WINDOW)
            .current_dir(&self.app)
            .args(["server.js", "--desktop"])
            .env_remove("NODE_OPTIONS")
            .env_remove("NODE_PATH")
            .env_remove("STUDIO_IMPORT_FROM")
            .env("STUDIO_DATA_DIR", self.local.join("data"))
            .env("STUDIO_TIKTOK_EXE", self.bin.join("tiktok-bridge.exe"))
            .env("HF_HOME", cache.join("huggingface"))
            .env("TMP", &cache)
            .env("TEMP", &cache)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(log);
        if let Some(folder) = import_from {
            command.env("STUDIO_IMPORT_FROM", folder);
        }
        let mut child = command.spawn()?;
        // Node waits on stdin until descendants can safely inherit the job.
        if unsafe { AssignProcessToJobObject(job.as_raw_handle(), child.as_raw_handle()) } == 0 {
            let error = io::Error::last_os_error();
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        let mut server = Server {
            child,
            job: Some(job),
        };
        let output = server.child.stdout.take().expect("piped stdout");
        let (send, receive) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(output).lines().map_while(Result::ok) {
                if line == "STUDIO_READY" {
                    let _ = send.send(Ok(()));
                } else if let Some(error) = line.strip_prefix("STUDIO_ERROR ") {
                    let _ = send.send(Err(error.to_owned()));
                }
            }
        });
        server
            .child
            .stdin
            .as_mut()
            .expect("piped stdin")
            .write_all(b"start\n")?;
        let timeout = if import_from.is_some() { 300 } else { 20 };
        match receive.recv_timeout(Duration::from_secs(timeout)) {
            Ok(Ok(())) => Ok(server),
            Ok(Err(message)) => Err(io::Error::other(message)),
            Err(_) => Err(io::Error::other(
                "El servidor local no respondió durante el arranque.",
            )),
        }
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        // EOF asks Node to close HTTP and flush its modules before stopping the process tree.
        drop(self.child.stdin.take());
        let deadline = Instant::now() + Duration::from_secs(12);
        while matches!(self.child.try_wait(), Ok(None)) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(40));
        }
        drop(self.job.take());
        let _ = self.child.wait();
    }
}

fn create_job() -> io::Result<OwnedHandle> {
    let raw = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
    if raw.is_null() {
        return Err(io::Error::last_os_error());
    }
    let job = unsafe { OwnedHandle::from_raw_handle(raw) };
    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    let success = unsafe {
        SetInformationJobObject(
            raw,
            JobObjectExtendedLimitInformation,
            std::ptr::from_ref(&limits).cast(),
            std::mem::size_of_val(&limits) as u32,
        )
    };
    if success == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(job)
}
