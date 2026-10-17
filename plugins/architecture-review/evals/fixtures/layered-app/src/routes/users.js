import { getUser } from '../services/users.js';
export const handleGetUser = (req) => getUser(Number(req.params.id));
