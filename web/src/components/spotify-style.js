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
    ...spotifyThemes.map(style => 'music-' + style),
    ...animationStyles.map(style => 'motion-' + style),
    'cover-glow', 'music-terminal', 'hide-visualizer',
  ]);
  const active = new Set([
    'player-' + playerStyle, 'cover-' + coverStyle, 'music-' + playerTheme,
    'motion-' + config.revealAnimation, 'motion-' + config.exitAnimation,
    ...(playerStyle === 'amber' ? ['player-shell'] : []),
    ...(['shell', 'amber'].includes(playerStyle) ? ['music-terminal'] : []),
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
      return selector === '.music-now' || (classes.length > 0 && classes.every(name => active.has(name)));
    });
    if (selectors.length) rule.selectors = selectors;
    else rule.remove();
  });
  source.walkAtRules(rule => {
    if (rule.nodes?.length === 0) rule.remove();
  });
  function formatBlock(block, depth) {
    const indent = '  '.repeat(depth);
    for (const node of block.nodes) {
      node.raws.before = depth ? '\n' + indent : node === source.first ? '' : '\n\n';
      if (node.type === 'decl') {
        node.raws.between = ': ';
      } else if (node.nodes) {
        node.raws.between = ' ';
        node.raws.after = '\n' + indent;
        node.raws.semicolon = true;
        formatBlock(node, depth + 1);
      }
    }
  }
  formatBlock(source, 0);
  const accent = config.magicColors ? '' : '\n\n' + cssDeclarations('.music-now', { '--music-accent': config.tintColor }, ' !important');
  return source.toString().trim() + accent;
}
