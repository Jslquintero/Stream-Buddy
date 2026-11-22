import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spotifyVisibility} from '../shared/spotify-visibility.js';
import {validateSpotifyConfig} from '../shared/spotify.js';
const song={title:'A',artist:'Artist',duration:100000,playing:true};
test('Spotify pause delay survives polling and cancels on resume',()=>{
  const c={hideWhenPaused:true,hideDelay:5};
  let state=spotifyVisibility({},song,c,0);
  state=spotifyVisibility(state,{...song,playing:false},c,1000);assert.equal(state.visible,true);
  state=spotifyVisibility(state,{...song,playing:false,progress:50},c,5999);assert.equal(state.visible,true);
  state=spotifyVisibility(state,{...song,playing:false},c,6000);assert.equal(state.visible,false);
  state=spotifyVisibility(state,song,c,6500);assert.equal(state.visible,true);
  state=spotifyVisibility(state,{...song,playing:false},c,7000);assert.equal(state.visible,true);
});
test('Spotify song-change window ignores progress, seeking and pause/resume',()=>{
  const c={songChangeOnly:true,visibleDuration:5,hideWhenPaused:false};
  let state=spotifyVisibility({},song,c,0);
  state=spotifyVisibility(state,{...song,progress:90000},c,4999);assert.equal(state.visible,true);
  state=spotifyVisibility(state,{...song,progress:0},c,5000);assert.equal(state.visible,false);
  state=spotifyVisibility(state,{...song,playing:false},c,6000);assert.equal(state.visible,false);
  state=spotifyVisibility(state,song,c,7000);assert.equal(state.visible,false);
  state=spotifyVisibility(state,{...song,title:'B'},c,8000);assert.equal(state.visible,true);
  assert.equal(spotifyVisibility(state,null,c,8001).visible,false);
});
test('Spotify combines pause and song timers and validates visibility settings',()=>{
  const c=validateSpotifyConfig({songChangeOnly:true,visibleDuration:10,hideWhenPaused:true,hideDelay:3,hideVisualizer:true});
  let state=spotifyVisibility({},song,c,0);
  state=spotifyVisibility(state,{...song,playing:false},c,1000);
  assert.equal(spotifyVisibility(state,{...song,playing:false},c,4000).visible,false);
  assert.equal(spotifyVisibility(state,song,c,5000).visible,true);
  assert.equal(spotifyVisibility(state,song,c,10000).visible,false);
  for(const invalid of [{hideDelay:-1},{visibleDuration:0},{visibleDuration:301},{hideVisualizer:1},{songChangeOnly:'yes'}])assert.throws(()=>validateSpotifyConfig(invalid));
});
