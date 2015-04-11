import React from 'react';
import Editor from './editor';
import Parser from './parser';

export default class MainUI extends React.Component {
    onPlay(src) {
        let parseResult = Parser.parse(src);
        if(parseResult.status) {
            console.log(JSON.stringify(parseResult.value));
        } else {
            console.log(Parser.formatError(src, parseResult));
        }
    }
    render() {
        return <Editor onPlay={(src) => this.onPlay(src)} />;
    }
}
