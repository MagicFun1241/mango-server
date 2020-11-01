import {createSchema, Type, typedModel} from "ts-mongoose";

enum TicketType {
    BugReport
}

enum TicketState {
    Opened,
    Closed
}

const TicketSchema = createSchema({
    type: Type.number({
        required: true,
        enum: [
            TicketType.BugReport
        ]
    }),
    state: Type.number({
        required: true,
        enum: [
            TicketState.Opened,
            TicketState.Closed
        ]
    }),
    creatorId: Type.objectId({ required: true })
});

export default typedModel("ticket", TicketSchema);