import { findUser } from '../db/users.js';
export const getUser = (id) => findUser(id);
