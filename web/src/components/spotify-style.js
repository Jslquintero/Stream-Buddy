import parse from 'postcss/lib/parse';
import { cssDeclarations } from '../../../shared/css-declarations';
import { animationStyles, coverFinishes, coverStyles, playerStyles, spotifyThemes } from '../../../shared/spotify';
import baseCss from './spotify.css?inline';
import finishCss from './spotify-cover-finishes.css?inline';
import skinCss from './spotify-skins.css?inline';

export const spotifyBaseCss = [baseCss, skinCss, finishCss].join('\n');

export function spotifyPlayerTheme(theme, playerStyle) {
  return theme === 'dark' && (playerStyle === 'cd-retro' || coverFinishes[playerStyle]) ? playerStyle : theme;
}

export function spotifyCurrentCss(config) {
  const { playerStyle, coverStyle, theme = 'dark' } = config;
  const playerTheme = spotifyPlayerTheme(theme, playerStyle);
  const variants = new Set([
    ...playerStyles.map(style => 'player-' + style),
    ...coverStyles.map(style => 'cover-' + style),
    ...spotifyThemes.map(style => 'spotify-' + style),
    ...animationStyles.map(style => 'motion-' + style),
    'cover-glow', 'spotify-terminal', 'hide-visualizer',
  ]);
  const active = new Set([
    'player-' + playerStyle, 'cover-' + coverStyle, 'spotify-' + playerTheme,
    'motion-' + config.revealAnimation, 'motion-' + config.exitAnimation,
    ...(playerStyle === 'amber' ? ['player-shell'] : []),
    ...(['shell', 'amber'].includes(playerStyle) ? ['spotify-terminal'] : []),
    ...(config.coverGlow ? ['cover-glow'] : []),
    ...(config.hideVisualizer ? ['hide-visualizer'] : []),
  ]);
  const source = parse(spotifyBaseCss, { map: false });
  source.walkComments(comment => comment.remove());
  source.walkAtRules(/keyframes$/, rule => rule.remove());
  source.walkRules(rule => {
    const selectors = rule.selectors.filter(selector => {
      // Classes in functional pseudo-classes can be alternatives or exclusions.
      const outsideFunctions = selector.replace(/\([^()]*\)/g, '');
      const classes = Array.from(outsideFunctions.matchAll(/\.([\w-]+)/g), match => match[1]).filter(name => variants.has(name));
      return selector === '.spotify-now' || (classes.length > 0 && classes.every(name => active.has(name)));
    });
    if (selectors.length) rule.selectors = selectors;
    else rule.remove();
  });
  source.walkAtRules(rule => {
    if (rule.nodes?.length === 0) rule.remove();
  });
  for (const node of source.nodes) node.raws.before = node === source.first ? '' : '\n';
  const accent = config.magicColors ? '' : '\n\n' + cssDeclarations('.spotify-now', { '--spotify-accent': config.tintColor }, ' !important');
  return source.toString().trim() + accent;
}
