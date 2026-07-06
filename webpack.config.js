const path = require('path');
const HTMLPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    index: './src/index.js',
    contentScript: './src/contentScript/index.jsx',
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]],
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'service_worker.js', to: 'service_worker.js' },
        { from: 'styles.css', to: 'styles.css' },
        { from: 'HOM-icon.png', to: 'HOM-icon.png' },
        { from: 'HOM_Logo.svg', to: 'HOM_Logo.svg' },
        { from: 'fonts', to: 'fonts' },
      ],
    }),
    new HTMLPlugin({
      title: 'AADI Extension',
      filename: 'index.html',
      chunks: ['index'],
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
};
