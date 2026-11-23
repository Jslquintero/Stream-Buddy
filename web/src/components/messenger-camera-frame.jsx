import { useId } from 'react';

const cameraPalettes={
  xp: {
    glass:['#b8e2f6','#c8d5dd','#b0c4d0','#b7d2e3'],
    edge:['#f6fcfe','#cfdee6','#7dc4d1','#32bdd4'],
    bevel:['#fff','#e5edf1','#d2e2eb'],
    outline:'#536e7d', inner:'#647078',
  },
  dark: {
    glass:['#303f59','#263248','#1b2537','#161e2d'],
    edge:['#7788a6','#526079','#3e4b63','#303f59'],
    bevel:['#667692','#46546e','#38445b'],
    outline:'#111824', inner:'#111824',
  },
  neon: {
    glass:['#522672','#3a2054','#19122b','#18294b'],
    edge:['#f2b7ff','#cf68ff','#a63df5','#658bff'],
    bevel:['#f2b7ff','#cf68ff','#658bff'],
    outline:'#8422ae', inner:'#170d26',
  },
  minimal: {
    glass:['#f0f1f4','#f0f1f4','#eceef2','#eceef2'],
    edge:['#fff','#fff','#e1e4e9','#e1e4e9'],
    bevel:['#fff','#fff','#f0f1f4'],
    outline:'#aeb3bb', inner:'#c7cbd2',
  },
  custom: {
    glass:['#142b43','#142b43','#142b43','#142b43'],
    edge:['var(--accent, #7dd3fc)','var(--accent, #7dd3fc)','var(--accent, #7dd3fc)','var(--accent, #7dd3fc)'],
    bevel:['#d4edfa','#9db8cc','#678399'],
    outline:'#101c29', inner:'#101c29',
  },
};

function cameraPalette(theme) {
  if(theme?.startsWith('custom-'))return cameraPalettes.custom;
  return Object.hasOwn(cameraPalettes,theme)?cameraPalettes[theme]:cameraPalettes.xp;
}

export function messengerCameraDefaultColor(theme) {
  return cameraPalette(theme).glass[0];
}
const artSize=110;
const opening={x:7.5,y:7.5,width:95,height:95,rx:3};
const rimPath='M12 .5h86Q108.5 .5 109.5 12v86q0 11-11.5 11.5H12Q.5 109.5 .5 98V12Q.5 1 12 .5Z';
const loopColors=['#29dcdc','#658bff','#c381f4','#8cde72'];

export function MessengerCameraOpening({ element, width, height }) {
  return <rect {...opening} fill="black" transform={`translate(${element.x*width/100} ${element.y*height/100}) scale(${element.w*width/100/artSize} ${element.h*height/100/artSize})`}/>;
}

export function MessengerCameraFrame({ theme='xp', color, animated }) {
  const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const palette=cameraPalette(theme);
  const tint=color&&color!==palette.glass[0]
    ? [1,3,5].map(index=>Number.parseInt(color.slice(index,index+2),16))
    : null;
  const shade=(original,gray,amount)=>tint
    ? `rgb(${tint.map(channel=>Math.round(channel+(gray-channel)*amount)).join(',')})`
    : original;
  const trim=(original,gray,amount)=>theme==='xp'?shade(original,gray,amount):original;
  return <svg viewBox={`0 0 ${artSize} ${artSize}`} width="100%" height="100%" display="block" aria-hidden="true">
    <defs>
      <mask id={id+'-rim'} maskUnits="userSpaceOnUse" x="0" y="0" width={artSize} height={artSize}>
        <rect width={artSize} height={artSize} fill="white"/>
        <rect {...opening} fill="black"/>
      </mask>
      <linearGradient id={id+'-glass'} x2=".15" y2="1">
        <stop stopColor={shade(palette.glass[0],255,.32)}/>
        <stop offset=".51" stopColor={shade(palette.glass[1],255,.45)}/>
        <stop offset=".52" stopColor={shade(palette.glass[2],100,.14)}/>
        <stop offset="1" stopColor={shade(palette.glass[3],255,.18)}/>
      </linearGradient>
      <linearGradient id={id+'-edge'} x1="0" x2=".65" y2="1">
        <stop stopColor={trim(palette.edge[0],255,.92)}/>
        <stop offset=".39" stopColor={trim(palette.edge[1],255,.55)}/>
        <stop offset=".66" stopColor={trim(palette.edge[2],255,.14)}/>
        <stop offset="1" stopColor={trim(palette.edge[3],80,.12)}/>
      </linearGradient>
      <linearGradient id={id+'-bevel'} x1="0" x2=".7" y2="1">
        <stop stopColor={palette.bevel[0]}/>
        <stop offset=".58" stopColor={trim(palette.bevel[1],255,.78)}/>
        <stop offset="1" stopColor={trim(palette.bevel[2],255,.64)}/>
      </linearGradient>
    </defs>
    <path d={rimPath} fill={`url(#${id}-glass)`} mask={`url(#${id}-rim)`}/>
    {animated&&<g fill="none" strokeWidth="4.6" strokeLinecap="round" strokeOpacity=".8" mask={`url(#${id}-rim)`}>
      {loopColors.map((hue,index)=>{
        const offset=-index*25;
        // Each dash and gap add up to one normalized lap around the rim.
        return <rect key={hue} x="3.9" y="3.9" width="102.2" height="102.2" rx="8" pathLength="100" stroke={hue} strokeDasharray="24 76" strokeDashoffset={offset}>
          <animate attributeName="stroke-dashoffset" from={offset} to={offset-100} dur="4s" repeatCount="indefinite"/>
        </rect>;
      })}
    </g>}
    <path d={rimPath} fill="none" stroke={trim(palette.outline,52,.62)} strokeOpacity=".8"/>
    <rect x="1.5" y="1.5" width="107" height="107" rx="10" fill="none" stroke={`url(#${id}-edge)`}/>
    <rect x="5.8" y="5.8" width="98.4" height="98.4" rx="4.7" fill="none" stroke={`url(#${id}-bevel)`} strokeWidth="1.4"/>
    <rect x="7" y="7" width="96" height="96" rx="3.5" fill="none" stroke={trim(palette.inner,56,.58)}/>
  </svg>;
}
