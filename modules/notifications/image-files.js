export const maxImageBytes = 20 * 1024 * 1024;
export const maxImageDataLength = Math.ceil(maxImageBytes / 3) * 4 + 64;
export function imageMimeFromBytes(bytes) {
  const starts = values => values.every((value,index) => bytes[index] === value);
  if(starts([137,80,78,71,13,10,26,10]))return 'image/png';
  if(starts([71,73,70,56,55,97])||starts([71,73,70,56,57,97]))return 'image/gif';
  if(starts([255,216,255]))return 'image/jpeg';
  if(starts([82,73,70,70])&&[87,69,66,80].every((value,index)=>bytes[index+8]===value))return 'image/webp';
  return null;
}
