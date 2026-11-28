import parse from 'postcss/lib/parse';

export const maxCustomThemes=20;
export const baseThemeCSS=`/* Plantilla editable. Solo afecta a este overlay.
   Las posiciones y tamaños se editan en el lienzo.
   Selectores: .layout-element, .layout-title, .layout-content,
   .row-icon-picture, .row-icon-name y .taskbar. */
:host {
  --accent: #7dd3fc;
  --title-background: #142b43;
  --text: #f1f5f9;
  font-family: "Segoe UI", sans-serif;
}

.layout-element {
  border: 2px solid var(--accent);
  border-radius: 12px;
  box-shadow: 0 0 16px #7dd3fc33;
}

.layout-title {
  background: var(--title-background);
  color: var(--text);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.layout-content {
  color: var(--text);
  /* El interior permanece transparente. */
  background: transparent;
}

.row-icon-picture {
  border: 2px solid var(--accent);
  border-radius: 10px;
}

.row-icon-name {
  color: var(--text);
  text-shadow: 0 2px 4px #000;
}

.taskbar .layout-title {
  background: linear-gradient(90deg, #142b43, #21526c);
}
`;

export function validateThemeCSS(css) {
  if(typeof css!=='string'||css.length>20000)throw new Error('El CSS admite hasta 20 000 caracteres.');
  let root;
  try{root=parse(css,{map:false});}
  catch(error){throw new Error(`CSS: ${error.reason||error.message} (línea ${error.line||1}, columna ${error.column||1}).`);}
  root.walkAtRules(rule=>{
    if(!['media','supports','container','keyframes','-webkit-keyframes'].includes(rule.name.toLowerCase()))throw new Error(`@${rule.name} no está disponible. Usa estilos locales, @media, @supports o @keyframes.`);
  });
  return css;
}

export function validateCustomThemes(value) {
  if(!Array.isArray(value)||value.length>maxCustomThemes)throw new Error('La biblioteca admite hasta 20 temas personalizados.');
  const ids=new Set();
  return value.map(theme=>{
    if(!theme||typeof theme.id!=='string'||!/^custom-[a-z0-9-]{1,70}$/.test(theme.id)||ids.has(theme.id)||typeof theme.name!=='string'||!theme.name.trim()||theme.name.length>60)throw new Error('Tema personalizado inválido.');
    ids.add(theme.id);
    const { cssEnabled } = theme;
    if(cssEnabled!==undefined&&typeof cssEnabled!=='boolean')throw new Error('Estado del CSS personalizado inválido.');
    return {id:theme.id,name:theme.name,css:validateThemeCSS(theme.css),...(cssEnabled===undefined?{}:{cssEnabled})};
  });
}
