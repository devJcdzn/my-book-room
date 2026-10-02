import { createContext } from 'react';

export const TabBarContext = createContext({
  setIsTabBarHidden: (_hidden: boolean) => {},
});
