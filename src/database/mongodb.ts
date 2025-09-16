import mongoose from 'mongoose';
import { rest } from '../index.js';

export async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
        rest.logger.info(`Connected to ${mongoose.connection.db?.databaseName} database`);
    } catch (error) {
        rest.logger.error('Error connecting to the database', error);
    }
}

mongoose.connection.on('error', (error) => {
    rest.logger.error('MongoDB connection error', error);
});

mongoose.connection.on('disconnected', () => {
    rest.logger.fatal('MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => {
    rest.logger.info('MongoDB reconnected');
});
