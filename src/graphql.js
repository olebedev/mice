// @flow

import gql from 'graphql-tag';

export const miceSubscription = gql`
  subscription Mice {
    result @node(id: "mice") {
      version
      length
      list: id @slice(begin: 0, end: 10) {
        id
        lastUpdate: version @date
        x
        y
        symbol
      }
    }
  }
`;

export const mouseQuery = gql`
  query MouseQuery($id: UUID!) {
    mouse @node(id: $id) {
      id
      version
      symbol
    }
  }
`;
