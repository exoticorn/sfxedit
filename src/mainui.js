import React from 'react';
import Editor from './editor';
import Parser from './parser';
import SfxPlayer from './sfxplayer';

let webAudio = new (window.AudioContext || window.webkitAudioContext)();

export default class MainUI extends React.Component {
    constructor(props) {
        super(props);
        this.state = { output: '' }
    }
    onPlay(src, cursor) {
        let parseResult = Parser.parse(src);
        if(parseResult.status) {
            let data = parseResult.value;
            this.setState({ output: JSON.stringify(data) });
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
            this.setState({ output: 'Error:\n\n' + Parser.formatError(src, parseResult) });
        }
    }
    selectOutput() {
        if(window.getSelection && document.createRange) {
            let selection = window.getSelection();
            let range = document.createRange();
            range.selectNode(this.refs.output.getDOMNode());
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
    render() {
        return <div>
                 <Editor onPlay={(src, cursor) => this.onPlay(src, cursor)} />
                 <h2>Output:</h2>
                 <pre style={{whiteSpace: 'pre-wrap'}} onClick={this.selectOutput.bind(this)} ref='output'>{this.state.output}</pre>
               </div>;
    }
}
