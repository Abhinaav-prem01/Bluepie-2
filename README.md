# BluePie

A React application that helps users find the cheapest grocery items within a 1km radius using Yelp and Google Maps APIs.

## Features

- Search for grocery items
- Find stores within 1km radius
- View store locations on Google Maps
- Get price comparisons
- See store ratings and distances

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Yelp API key
- Google Maps API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your API keys:
   ```
   REACT_APP_YELP_API_KEY=your_yelp_api_key
   REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Getting API Keys

### Yelp API Key
1. Go to [Yelp Fusion API](https://www.yelp.com/developers)
2. Create an account and register your application
3. Get your API key from the dashboard

### Google Maps API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Maps JavaScript API
4. Create credentials and get your API key

## Usage

1. Click "Get Location" to allow the app to access your current location
2. Enter the grocery item you're looking for in the search box
3. Click "Search" to find stores in your area
4. View the results on the map and in the list below
5. Results are sorted by price level (cheapest first)

## Technologies Used

- React
- Google Maps JavaScript API
- Yelp Fusion API
- Tailwind CSS
- Axios 