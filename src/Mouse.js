// @flow

import * as React from 'react';

type props = {
  id: string,
  x: number,
  y: number,
  symbol: string,
  onClick(): void,
};

class Mouse extends React.Component<props> {
  render() {
    const { x, y, symbol } = this.props;
    return (
      <span
        onClick={() => this.props.onClick()}
        className="mouse"
        style={{
          top: y + 'px',
          left: x + 'px',
        }}>
        {symbol}
      </span>
    );
  }
}

export default Mouse;
