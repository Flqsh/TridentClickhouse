import { createEmbeds } from '@discordeno/bot';

const errorEmbed = (description?: string) =>
    createEmbeds()
        .setColor('fb4541')
        .setTitle('Something went wrong')
        .setDescription(description ?? '');

export default { errorEmbed };
