export type MessagePayload<T = any> = {
    event_version: number;
    occurred_on: Date;
    payload: T;
    event_name: string;
    messageId: string;
};

export type BrokerConfig = {
    exchange: string;
    routingKey: string;
};

export type BrokerPublishOptions = {
    correlationId?: string;
    headers?: Record<string, any>;
    persistent?: boolean;
    expiration?: string | number;
    userId?: string;
    CC?: string | string[];
    BCC?: string | string[];
    replyTo?: string;
    messageId?: string;
    timestamp?: number;
    type?: string;
    appId?: string;
};

export const MESSAGE_BROKER_SERVICE_TOKEN = Symbol('MessageBrokerService');

export interface IMessageBrokerService {
    publishMessage(
        config: BrokerConfig,
        message: MessagePayload,
        options?: BrokerPublishOptions,
    ): Promise<void>;

    transformMessageToMessageBroker<T = any>(
        eventName: string,
        message: T,
        event_version?: number,
        occurred_on?: Date,
    ): MessagePayload<T>;
}
