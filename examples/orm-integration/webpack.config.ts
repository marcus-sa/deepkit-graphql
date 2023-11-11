import { composePlugins, withNx } from '@nx/webpack';
import { withDeepkit } from '@deepkit-modules/nx-webpack-plugin';

// eslint-disable-next-line import/no-default-export
export default composePlugins(withNx(), withDeepkit());
