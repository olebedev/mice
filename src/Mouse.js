// @flow

import * as React from 'react';

type Props = {
  highligted: boolean,
  x: number,
  y: number,
  symbol: string,
  onClick(): void,
};

class Mouse extends React.Component<Props> {
  render() {
    const { x, y, symbol } = this.props;
    return (
      <span
        onClick={this.props.onClick}
        className="mouse"
        style={{
          top: `${y}px`,
          left: `${x}px`,
        }}>
        {symbol}
      </span>
    );
  }
}

export default Mouse;
