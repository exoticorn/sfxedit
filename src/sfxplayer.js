export default function SfxPlayer(data, webAudio) {
    if(!webAudio) {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if(AudioContext) {
            webAudio = new AudioContext();
        }
    }

    var oneBuffer = webAudio.createBuffer(1, 128, 22050);
    var oneData = oneBuffer.getChannelData(0);
    var i;
    for(i = 0; i < 128; ++i) {
        oneData[i] = 1;
    }

    function compileParam(ctx, node, param, scale) {
        if(Array.isArray(node)) {
            scale = scale || 1;
            for(var i = 0; i < node.length; ++i) {
                var cmd = node[i];
                var time = ctx.start + cmd.time / 60;
                if(cmd.set !== undefined) {
                    param.setValueAtTime(cmd.set * scale, time);
                } else {
                    param.linearRampToValueAtTime(cmd.slide * scale, time);
                }
            }
        } else if(typeof(node) === 'number') {
            param.value = node;
        } else {
            var input = compile(ctx, node);
            if(scale) {
                var gain = webAudio.createGain();
                input.connect(gain);
                gain.gain.value = scale;
                input = gain;
            }
            input.connect(param);
        }
    }

    function one(ctx) {
        if(!ctx.one) {
            ctx.one = webAudio.createBufferSource();
            ctx.one.buffer = oneBuffer;
            ctx.one.loop = true;
            ctx.one.start(ctx.start);
            ctx.one.stop(ctx.end);
        }
        return ctx.one;
    }

    function compile(ctx, node) {
        if(Array.isArray(node) || typeof(node) === 'number') {
            var result = webAudio.createGain();
            one(ctx).connect(result);
            compileParam(ctx, node, result.gain);
            return result;
        } else if(node.op) {
            switch(node.op) {
            case '*':
                var left = compile(ctx, node.left);
                var result = webAudio.createGain();
                left.connect(result);
                compileParam(ctx, node.right, result.gain);
                return result;
            case '+':
                var result = webAudio.createGain();
                compile(ctx, node.left).connect(result);
                compile(ctx, node.right).connect(result);
                return result;
            }
        } else if(node.call) {
            switch(node.call) {
            case 'sine':
            case 'triangle':
            case 'sawtooth':
            case 'square':
                var result = webAudio.createOscillator();
                result.type = node.call;
                result.frequency.value = node.params[1] || 440;
                compileParam(ctx, node.params[0], result.detune, 100);
                result.start(ctx.start);
                result.stop(ctx.end);
                return result;
            }
        }
    }

    function calcDuration(node) {
        if(Array.isArray(node)) {
            return node[node.length - 1].time;
        }
        var duration = node.left ? Math.max(calcDuration(node.left), calcDuration(node.right)) : 0;
        if(node.params) {
            for(var i = 0; i < node.params.length; ++i) {
                duration = Math.max(duration, calcDuration(node.params[i]));
            }
        }
        return duration;
    }
    
    function sfx(data) {
        if(!webAudio) {
            return function() {};
        }
        var duration = calcDuration(data.body);
        return function() {
            var time = webAudio.currentTime;
            var ctx = {
                start: time,
                end: time + duration
            };
            compile(ctx, data.body).connect(webAudio.destination);
        };
    }
    
    for(var i = 0; i < data.length; ++i) {
        var fx = data[i];
        this[fx.name] = sfx(data[i]);
    }
}
