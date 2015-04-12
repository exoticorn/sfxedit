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

    function compileParam(node, scale) {
        if(Array.isArray(node)) {
            scale = scale || 1;
            return function(ctx, param) {
                for(var i = 0; i < node.length; ++i) {
                    var cmd = node[i];
                    var time = ctx.start + cmd.time / 60;
                    if(cmd.set !== undefined) {
                        param.setValueAtTime(cmd.set * scale, time);
                    } else {
                        param.linearRampToValueAtTime(cmd.slide * scale, time);
                    }
                }
            };
        } else if(typeof(node) === 'number') {
            var value = node * (scale || 1);
            return function(ctx, param) {
                param.value = value;
            };
        } else {
            var input = compileInput(node);
            if(scale) {
                return function(ctx, param) {
                    var gain = webAudio.createGain();
                    input(ctx, gain);
                    gain.gain.value = scale;
                    gain.connect(param);
                };
            } else {
                return function(ctx, param) {
                    input(ctx, param);
                };
            }
        }
    }

    function compileInput(node) {
        if(Array.isArray(node) || typeof(node) === 'number') {
            var param = compileParam(node);
            return function(ctx, out) {
                var gain = webAudio.createGain();
                one(ctx).connect(gain);
                param(ctx, gain.gain);
                gain.connect(out);
            };
        } else if(node.op) {
            switch(node.op) {
            case '*':
                var left = compileInput(node.left);
                var right = compileParam(node.right);
                return function(ctx, out) {
                    var gain = webAudio.createGain();
                    left(ctx, gain);
                    right(ctx, gain.gain);
                    gain.connect(out);
                };
            case '+':
                var left = compileInput(node.left);
                var right = compileInput(node.right);
                return function(ctx, out) {
                    left(ctx, out);
                    right(ctx, out);
                };
            default:
                throw 'Unsupported operator: ' + node.op;
            }
        } else {
            switch(node.call) {
            case 'sine':
            case 'triangle':
            case 'sawtooth':
            case 'square':
                var freq = node.params[1] ? compileParam(node.params[1]) : undefined;
                var detune = compileParam(node.params[0], 100);
                var type = node.call;
                return function(ctx, out) {
                    var osc = webAudio.createOscillator();
                    osc.type = type;
                    if(freq) {
                        freq(ctx, osc.frequency);
                    }
                    detune(ctx, osc.detune);
                    osc.start(ctx.start);
                    osc.stop(ctx.end);
                    osc.connect(out);
                };
            default:
                throw "Unsupported function '" + node.call + "'";
            }
        }
    }
    
    function sfx(data) {
        if(!webAudio) {
            return function() {};
        }
        var duration = calcDuration(data.body);
        var buildGraph = compileInput(data.body);
        return function() {
            var time = webAudio.currentTime;
            var ctx = {
                start: time,
                end: time + duration
            };
            buildGraph(ctx, webAudio.destination);
        };
    }
    
    for(var i = 0; i < data.length; ++i) {
        var fx = data[i];
        this[fx.name] = sfx(data[i]);
    }
}
