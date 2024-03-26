//webpack.config.js
const path = require('path');

module.exports = (env) => {
  return {
    mode: env.production ? "production" : "development",
    externals: {
      "config": JSON.stringify({
        "path": env.path
      }),
    },
    devServer: {
      hot: true
    },
    entry: {
      main: "./src/app.ts"
    },
    output: {
      path: path.resolve(__dirname, './dist'),
      filename: "app-bundle.js"
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
};
