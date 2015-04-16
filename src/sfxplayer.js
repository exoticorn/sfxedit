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

    var NOISE_LENGTH = 65536;
    var noiseBuffer = webAudio.createBuffer(1, NOISE_LENGTH, 44100);
    var noiseData = noiseBuffer.getChannelData(0);
    for(i = 0; i < NOISE_LENGTH; ++i) {
        noiseData[i] = Math.random() * 2 - 1;
    }

    function noiseRate(f) {
        return Math.pow(0.75, (1 - f) * 15);
    }

    var noiseCurve = new Float32Array(31);
    for(i = 0; i < 31; ++i) {
        noiseCurve[i] = noiseRate(Math.max(0, (i-15) / 15));
    }

    var identityConfig = {
        value: function(v) { return v; },
        input: function(i) { return i; }
    };

    function scaleConfig(scale) {
        return {
            value: function(v) { return v * scale; },
            input: function(i) {
                return function(ctx, param) {
                    var gain = webAudio.createGain();
                    i(ctx, gain);
                    gain.gain.value = scale;
                    gain.connect(param);
                };
            }
        };
    }

    var detuneConfig = scaleConfig(100);

    var noiseConfig = {
        value: noiseRate,
        input: function() { throw "noise only supports values or envelopes for input for now"; },
        exponential: true
    };

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
            return constMax(node[node.length - 1].time) / 60;
        }
        var duration = node.left ? Math.max(calcDuration(node.left), calcDuration(node.right)) : 0;
        if(node.params) {
            for(var i = 0; i < node.params.length; ++i) {
                duration = Math.max(duration, calcDuration(node.params[i]));
            }
        }
        return duration;
    }

    function constMax(expr) {
        if(typeof(expr) === 'number') {
            return expr;
        } else if(expr.rmin !== undefined) {
            return constMax(expr.rmax);
        } else if(expr.op === '*') {
            return constMax(expr.left) * constMax(expr.right);
        } else if(expr.op === '+') {
            return constMax(expr.left) * constMax(expr.right);
        }
        throw "Failed to eval const '" + JSON.stringify(expr) + "'";
    }

    function compileConst(expr) {
        if(typeof(expr) === 'number') {
            return function() { return expr; };
        } else if(expr.rmin !== undefined) {
            var min = compileConst(expr.rmin), max = compileConst(expr.rmax);
            return function() { var a = min(), b = max(); return a + Math.random() * (b-a); };
        } else if(expr.op === '*') {
            var left = compileConst(expr.left), right = compileConst(expr.right);
            return function() { return left() * right(); };
        } else if(expr.op === '+') {
            var left = compileConst(expr.left), right = compileConst(expr.right);
            return function() { return left() + right(); };
        }
        throw "Failed to compile const '" + JSON.stringify(expr) + "'";
    }

    function compileParam(node, config) {
        config = config || identityConfig;
        if(Array.isArray(node)) {
            for(var i = 0; i < node.length; ++i) {
                node[i].time = compileConst(node[i].time);
                if(node[i].set) {
                    node[i].set = compileConst(node[i].set);
                } else {
                    node[i].slide = compileConst(node[i].slide);
                }
            }
            return function(ctx, param) {
                for(var i = 0; i < node.length; ++i) {
                    var cmd = node[i];
                    var time = ctx.start + cmd.time() / 60;
                    if(cmd.set !== undefined) {
                        param.setValueAtTime(config.value(cmd.set()), time);
                    } else if(config.exponential) {
                        param.exponentialRampToValueAtTime(config.value(cmd.slide()), time);
                    } else {
                        param.linearRampToValueAtTime(config.value(cmd.slide()), time);
                    }
                }
            };
        } else if(typeof(node) === 'number') {
            var value = config.value(node);
            return function(ctx, param) { param.value = value; };
        } else if(node.rmin !== undefined) {
            var value = compileConst(node);
            return function(ctx, param) { param.value = config.value(value()); }
        } else {
            var input = config.input(compileInput(node));
            return function(ctx, param) {
                input(ctx, param);
            };
        }
    }

    function compileInput(node) {
        if(Array.isArray(node) || typeof(node) === 'number' || node.rmin !== undefined) {
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
                var detune = compileParam(node.params[0], detuneConfig);
                var type = node.call;
                return function(ctx, out) {
                    var osc = webAudio.createOscillator();
                    osc.type = type;
                    if(freq) {
                        osc.frequency.value = 0;
                        freq(ctx, osc.frequency);
                    }
                    detune(ctx, osc.detune);
                    osc.start(ctx.start);
                    osc.stop(ctx.end);
                    osc.connect(out);
                };
            case 'noise':
                var freq = compileParam(node.params[0], noiseConfig);
                return function(ctx, out) {
                    var noise = webAudio.createBufferSource();
                    noise.buffer = noiseBuffer;
                    noise.loop = true;
                    noise.playbackRate.value = 0;
                    freq(ctx, noise.playbackRate);
                    noise.start(ctx.start);
                    noise.stop(ctx.end);
                    noise.connect(out);
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
