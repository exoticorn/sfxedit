module.exports = {
    entry: "./src/entry.js",
    output: {
        path: __dirname,
        filename: "bundle.js"
    },
    module: {
        loaders: [
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader?optional=runtime" },
            { test: /\.json$/, loader: "json-loader" }
        ]
    }
}
