// @flow

import * as React from 'react';
import SwarmDB from 'swarm-db';
import { LocalStorage as Storage } from 'swarm-client';
import { UUID } from 'swarm-ron';
import { Verbose } from 'swarm-client/lib/connection';

import type { Response } from 'swarm-db';
import type { Atom } from 'swarm-ron';

import './App.css';
import Mouse from './Mouse';
import { mouseQuery, miceSubscription } from './graphql';

const FREQ = 30;
const TO_CHECK_MIN = 6e4;
const TO_CHECK_MAX = 6e4 * 2;
const ABANDONED = TO_CHECK_MIN;
const ADD_DEBOUNCE = 150;
const STATUS_CHECK = 150;

type Update = {
  result: {
    length: number,
    list: Array<{
      id: string,
      lastUpdate: Date,
      x: number,
      y: number,
      symbol: string,
    }>,
  },
};

type State = {
  id: string,
  online: boolean,
  connected: boolean,
  state: number,
  mouse: string,
  mice: $PropertyType<$PropertyType<Update, 'result'>, 'list'>,
};

class App extends React.Component<any, State> {
  state = {
    id: '',
    online: true,
    connected: false,
    state: 0,
    mouse: '',
    mice: [],
  };

  throttle: TimeoutID | null;
  swarm: SwarmDB;
  statusCheck: IntervalID;
  miceTimeoutCheck: TimeoutID;
  add: TimeoutID;

  constructor(props: any, context: any) {
    super(props, context);
    this.swarm = new SwarmDB({
      storage: new Storage(),
      upstream: new Verbose('wss://swarm.toscale.co'),
      db: { name: 'default' },
    });

    window.view = this;

    this.statusCheck = setInterval(() => {
      const connected = this.swarm.client.upstream.readyState === 1;
      if (this.state.connected !== connected) {
        this.setState({ connected });
      }
    }, STATUS_CHECK);

    // wait the swarm to be initialized
    this.swarm.ensure().then(async () => {
      console.log('initialized');
      // create scoped ref
      // $FlowFixMe
      const mouse = new UUID('mouse', this.swarm.client.db.id, '$');
      this.swarm.add('mice', mouse);

      // subscribe to the set
      this.swarm.execute({ gql: miceSubscription }, this.onUpdate);

      // put the mouse into the state
      this.setState({
        id: this.swarm.client.db.id,
        mouse: mouse.toString(),
      });

      // check if mouse is not initialized yet
      // and init it if needed
      this.swarm
        .execute(
          { gql: mouseQuery, args: { id: mouse } },
          (update: Response<mixed>): void => {
            // $FlowFixMe
            const { version, symbol } = update.data.mouse;
            if (version === '0' || !symbol)
              this.swarm.set(mouse, {
                symbol: getSymbol(),
              });
          },
        )
        .catch(e => {
          console.error(e);
        });
    });
  }

  onUpdate = (update: Response<Update>): void => {
    if (update.data) {
      this.setState({ mice: update.data.result.list }, () => {
        // apply immediately at the first time
        if (!this.miceTimeoutCheck) this.dropAbandoned();
      });
    }
  };

  dropAbandoned = () => {
    const now = Date.now();
    for (const m of this.state.mice) {
      if (now - m.lastUpdate.getTime() > ABANDONED) {
        this.swarm.remove('mice', UUID.fromString(m.id));
      }
    }
    console.log('drop abandoned');
    this.miceTimeoutCheck = setTimeout(
      this.dropAbandoned,
      getRandom(TO_CHECK_MIN, TO_CHECK_MAX),
    );
  };

  kill(num: number = 1): void {
    const toKill = [];
    for (const m of this.state.mice) {
      if (m.id !== this.state.mouse) {
        toKill.push(m);
      }
      if (toKill.length >= num) break;
    }

    for (const m of toKill) {
      this.swarm.remove('mice', UUID.fromString(m.id));
    }
  }

  addToMice = () => {
    clearTimeout(this.add);
    this.add = setTimeout(() => {
      const { mouse, mice } = this.state;
      if (!mouse) return;
      if (!mice.filter(m => m.id === mouse).length) {
        this.swarm.add('mice', UUID.fromString(mouse));
      }
    }, ADD_DEBOUNCE);
  };

  handleOnline = (e: Event) => {
    const online = !this.state.online;
    this.setState({ online });
    if (online) {
      this.swarm.client.upstream.open();
      this.addToMice();
    } else {
      this.swarm.close();
    }
  };

  handleMove = (e: Event) => {
    if (!this.state.id) return;
    this.addToMice();
    // $FlowFixMe
    const x = e.clientX - 10;
    // $FlowFixMe
    const y = e.clientY - 16;

    this.throttle =
      this.throttle ||
      setTimeout(() => {
        this.set({ x, y });
        this.throttle = null;
      }, FREQ);
  };

  handleTouchMove = (e: Event) => {
    // $FlowFixMe
    this.handleMove(e.touches[0]);
    e.preventDefault();
  };

  set(data: { [string]: Atom | void }): void {
    this.swarm.set(this.state.mouse, data);
  }

  reset = () => {
    this.swarm.close();
    localStorage.clear();
    window.location.reload();
  };

  render() {
    const { mice, mouse } = this.state;
    return (
      <span>
        <div
          className={`app ${this.state.connected ? 'appConnected' : ''}`.trim()}
          onMouseMove={this.handleMove}
          onTouchMove={this.handleTouchMove}>
          {mice.map(item => {
            const { x, y, symbol, id } = item;
            return (
              !!id && (
                <Mouse
                  highligted={mouse === id}
                  key={id}
                  x={x}
                  y={y}
                  symbol={symbol || getSymbol()}
                  onClick={
                    id === mouse
                      ? () => this.set({ symbol: getSymbol() })
                      : () => {}
                  }
                />
              )
            );
          })}
        </div>
        <div className="online">
          <label>
            <input
              type="checkbox"
              checked={this.state.online}
              onChange={this.handleOnline}
            />
            online {this.state.id && `(${this.state.id})`}
          </label>
          <button onClick={this.reset} className="reset" type="button">
            reset state
          </button>
        </div>
      </span>
    );
  }
}

function getSymbol() {
  return String.fromCharCode(getRandom(10000, 10060));
}

function getRandom(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

export default App;
