import Resolver, {Test} from "../classes/resolver";

import TeamModel, {TeamInterface} from "../schemas/team";

@Test
export default class Team extends Resolver<TeamInterface>{
    constructor() {
        super(TeamModel);
    }

    static a() {
        
    }
}