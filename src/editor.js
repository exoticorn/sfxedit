import React from 'react';
import Ace from 'brace';

export default class Editor extends React.Component {
    componentDidMount() {
        let div = this.refs.editor.getDOMNode();
        this.editor = Ace.edit(div);
        this.editor.$blockScrolling = Infinity;
        let text = window.localStorage.getItem('sfxSource') || '';
        this.editor.setValue(text, -1);
        this.editor.focus();
        this.editor.on('change', () => this.onChange());
        div.onkeydown = (e) => this.onKeyDown(e);
    }
    onChange() {
        window.clearTimeout(this.timeout);
        let title = 'SfxEditor';
        document.title = title + ' *';
        this.timeout = window.setTimeout(() => {
            window.localStorage.setItem('sfxSource', this.editor.getValue());
            document.title = title;
        }, 2000);
    }
    onKeyDown(e) {
        if(e.ctrlKey && e.keyCode === 83) {
            if(this.props.onPlay) {
                let position = this.editor.getCursorPosition();
                let index = this.editor.getSession().getDocument().positionToIndex(position);
                this.props.onPlay(this.editor.getValue(), index);
            }
            e.preventDefault();
        }
    }
    render() {
        let style = { width: 600, height: 600 };
        return <div ref='editor' style={style} />
    }
}
