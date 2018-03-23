// @flow
import {WebSocket as RWS} from 'swarm-client';

export default class DebugConn extends RWS {
  _om: (ev: MessageEvent) => any;
  _oo: (ev: Event) => any;

  constructor(url: string, protocols: string[] = [], options: {} = {}) {
    super(url, protocols, options);
    const send = this.send;
    this.send = (data: string): void => {
      console.log('%c(≶) %c%s %c%s', 'color: blue', 'color: green;', '~>', 'color: #aaa', data);
      send(data);
    };
  }

  get onopen(): (ev: Event) => any {
    return (ev: Event) => {
      console.log(
        '%c(≶) %c%s',
        'color: blue;',
        'color: green;',
        // $FlowFixMe
        'connected to ' + this._url,
      );
      this._oo(ev);
    };
  }

  set onopen(m: (ev: Event) => void): void {
    this._oo = m;
  }

  get onmessage(): (ev: MessageEvent) => any {
    return (ev: MessageEvent) => {
      console.log('%c(≶) %c%s %c%s', 'color: blue;', 'color: red;', '<~', 'color: #aaa', ev.data);
      this._om(ev);
    };
  }

  set onmessage(m: (ev: MessageEvent) => any): void {
    this._om = m;
  }
}
