import React from 'react';
import Editor from './editor';
import Parser from './parser';
import SfxPlayer from './sfxplayer';

let webAudio = new (window.AudioContext || window.webkitAudioContext)();

export default class MainUI extends React.Component {
    onPlay(src) {
        let parseResult = Parser.parse(src);
        if(parseResult.status) {
            let data = [parseResult.value];
            console.log(JSON.stringify(data));
            let sfx = new SfxPlayer(data, webAudio);
            sfx[data[0].name]();
        } else {
            console.log(Parser.formatError(src, parseResult));
        }
    }
    render() {
        return <Editor onPlay={(src) => this.onPlay(src)} />;
    }
}
