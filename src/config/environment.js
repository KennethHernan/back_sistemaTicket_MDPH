import { config } from "dotenv"
config()

export const env = {
    jwt_secret: process.env.jwt_secret,
    DB_URI: process.env.DB_URI,
}