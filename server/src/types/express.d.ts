import { IUser } from '../models/User.model';
import { IAccessToken } from '../models/AccessToken.model';
import { ITeam } from '../models/Team.model';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      /** Set by the public-API token middleware (apiAuth). */
      apiToken?: IAccessToken;
      apiTeam?: ITeam;
    }
  }
}
