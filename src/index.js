// @flow
//
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

const rootEl = document.getElementById('root');
// $FlowFixMe
ReactDOM.render(<App />, rootEl);

if (module.hot) {
  // $FlowFixMe
  module.hot.accept('./App', () => {
    const NextApp = require('./App').default;
    // $FlowFixMe
    ReactDOM.render(<NextApp />, rootEl);
  });
}
