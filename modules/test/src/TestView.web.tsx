import * as React from 'react';

import { TestViewProps } from './Test.types';

export default function TestView(props: TestViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
