import TeamModel, {TeamInterface} from "../schemas/team";

import createResolver from "../modules/resolver";

const TeamResolver = createResolver<TeamInterface>(TeamModel, 2 * 60);

export default TeamResolver;
