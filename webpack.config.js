//webpack.config.js
const path = require('path');

module.exports = {
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    hot: true
  },
  entry: {
    main: "./src/app.ts"
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: "app-bundle.js" // <--- Will be compiled to this single file
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      { 
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  },
  devServer: {
    static: {
      directory: '.',
    },
    port: 8081,
    host: '0.0.0.0',
    allowedHosts: 'all',
  }
};
