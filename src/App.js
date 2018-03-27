// @flow

import * as React from 'react';
import gql from 'graphql-tag';
import SwarmDB from 'swarm-db';
import type { Response } from 'swarm-db';
import {
  // InMemory as Storage,
  LocalStorage as Storage,
} from 'swarm-client';
import type { Atom } from 'swarm-ron';
import { UUID } from 'swarm-ron';
import './App.css';
import Mouse from './Mouse';
import Conn from './conn';

const FREQ = 30;
const TO_CHECK_MIN = 6e4; // 1 min
const TO_CHECK_MAX = 6e4 * 2; // 2 min
const ABANDONED = TO_CHECK_MIN;
const ADD_DEBOUNCE = 150;
const STATUS_CHECK = 150;

const sub = gql`
  subscription Mice {
    result @node(id: "mice") {
      version
      length
      list: id @node @slice(begin: 0) {
        id
        lastUpdate: version @date
        x
        y
        symbol
      }
    }
  }
`;

const mouseQuery = gql`
  query MouseQuery($id: UUID!) {
    mouse @node(id: $id) {
      id
      version
      symbol
    }
  }
`;

type subUpdate = {
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

type state = {
  id: string,
  online: boolean,
  connected: boolean,
  state: number,
  mouse: string,
  mice: $PropertyType<$PropertyType<subUpdate, 'result'>, 'list'>,
};

class App extends React.Component<*, state> {
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
      upstream: new Conn('wss://swarm.toscale.co'),
      db: { name: 'default' },
    });

    window.view = this;

    this.statusCheck = setInterval(() => {
      const connected = this.swarm.client.upstream.readyState === 1;
      if (this.state.connected !== connected) {
        this.setState({ connected });
      }
    }, STATUS_CHECK);

    this.dropAbandoned();

    // install subscription
    this.swarm.ensure().then(async () => {
      // create scoped ref
      // $FlowFixMe
      const mouse = new UUID('mouse', this.swarm.client.db.id, '$').toString();
      this.swarm.add('mice', UUID.fromString(mouse));

      // subscribe to the set
      this.swarm.execute({ gql: sub }, this.onUpdate);

      // put it into the state
      this.setState({ id: this.swarm.client.db.id, mouse });

      // init mouse if needed
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

  onUpdate = (update: Response<subUpdate>): void => {
    if (update.data) {
      this.setState({ mice: update.data.result.list });
    }
  };

  dropAbandoned = () => {
    const now = Date.now();
    for (const m of this.state.mice) {
      if (now - m.lastUpdate.getTime() > ABANDONED) {
        this.swarm.remove('mice', UUID.fromString(m.id));
      }
    }
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

  removeCurrent = () => {
    if (!this.state.mouse) return;
    this.swarm.remove('mice', UUID.fromString(this.state.mouse));
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
        this.set(this.state.mouse, { x, y });
        this.throttle = null;
      }, FREQ);
  };

  handleTouchMove = (e: Event) => {
    // $FlowFixMe
    this.handleMove(e.touches[0]);
    e.preventDefault();
  };

  set = (id: string, data: { [string]: Atom | void }) => {
    // only own scoped mouse
    if (this.state.mouse && id === this.state.mouse.toString()) {
      this.swarm.set(this.state.mouse, data);
    }
  };

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
                  main={mouse === id}
                  id={id}
                  key={id}
                  x={x}
                  y={y}
                  symbol={symbol || getSymbol()}
                  onClick={() => this.set(id, { symbol: getSymbol() })}
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
            reset
          </button>
        </div>
      </span>
    );
  }
}

function getSymbol() {
  return String.fromCharCode(10000 + Math.round((Math.random() * 10000) % 60));
}

function getRandom(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

export default App;
