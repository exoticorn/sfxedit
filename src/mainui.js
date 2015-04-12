import React from 'react';
import Editor from './editor';
import Parser from './parser';
import SfxPlayer from './sfxplayer';

let webAudio = new (window.AudioContext || window.webkitAudioContext)();

export default class MainUI extends React.Component {
    onPlay(src, cursor) {
        let parseResult = Parser.parse(src);
        if(parseResult.status) {
            let data = parseResult.value;
            console.log(JSON.stringify(data));
            let current;
            for(let fx of data) {
                if(fx.start <= cursor && (!current || fx.start > current.start)) {
                    current = fx;
                }
            }
            if(current) {
                let sfx = new SfxPlayer(data, webAudio);
                sfx[current.name]();
            }
        } else {
            console.log(Parser.formatError(src, parseResult));
        }
    }
    render() {
        return <Editor onPlay={(src, cursor) => this.onPlay(src, cursor)} />;
    }
}
