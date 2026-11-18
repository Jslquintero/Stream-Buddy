import { maxBackgroundImageLength, maxIconImageLength } from '../../../shared/layout';

export async function readBackgroundImage(file, {maxSize=2048,maxLength=maxBackgroundImageLength}={}) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Selecciona una imagen PNG, JPG o WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 10 MB.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo abrir esa imagen.'));image.src=url;});
    const scale=Math.min(1,maxSize/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('No se pudo preparar la imagen.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/webp',.85);
    if(data.length>maxLength)throw new Error('La imagen sigue siendo demasiado grande. Prueba una de menor resolución.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}
export const readIconImage = file => readBackgroundImage(file,{maxSize:256,maxLength:maxIconImageLength});
