// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_true_rhodey.sql';
import m0001 from './0001_blushing_northstar.sql';
import m0002 from './0002_dizzy_gravity.sql';
import m0003 from './0003_regular_cannonball.sql';
import m0004 from './0004_broad_randall.sql';
import m0005 from './0005_plain_joystick.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  