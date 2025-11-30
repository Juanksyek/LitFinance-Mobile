import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  plugins: [
    "expo-asset"
  ],
  extra: {
    API_BASE_URL: process.env.API_BASE_URL,
  },
});
