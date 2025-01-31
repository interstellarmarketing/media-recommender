# TV & Movie Recommender – Design and Implementation Plan

This document outlines a comprehensive plan for building a simple web app that, given a list of TV shows and/or movies the user likes, will fetch recommendations from TMDB’s API and display them. The plan covers design decisions, data flows, recommendation logic, user experience, security considerations, sample code, and next steps.

---

## 1. High-Level Design

### 1.1 Front-End Framework or UI Approach

- **React**: Popular, extensive community, component-based architecture, easy to integrate with various libraries. Great if you anticipate adding more complex features.
- **Plain HTML/JS**: Suitable for a minimal prototype, but not recommended if you plan to scale up.

**Chosen Approach**: **React** on the front end for component-based development and easy expandability.

### 1.2 Back-End Options

- **Node.js with Express**: Common in full-stack JavaScript. Straightforward to set up with React.
- **Serverless (Vercel Functions)**: Avoid the overhead of maintaining a server; deploy serverless functions that handle API requests securely. Ideal if you’re using Vercel for hosting.

**Chosen Approach**: **Serverless functions** on Vercel to keep the architecture lightweight and simplify deployments.

### 1.3 Deployment Suggestions

- **Vercel**: Seamless deployment for React apps, built-in support for serverless functions, easy environment variable management.
- **Netlify/Heroku**: Good alternatives, but Vercel is particularly streamlined for React + Next.js.

**Chosen Approach**: **Vercel** for both hosting the front end and deploying serverless back-end functions.

---

## 2. Data Flows & API Integration

### 2.1 TMDB API Integration

You’ll likely use these TMDB endpoints:
- **Search Endpoint** (optional, if searching by text):  
  - `GET https://api.themoviedb.org/3/search/movie`  
  - `GET https://api.themoviedb.org/3/search/tv`
- **Recommendation Endpoint** (for each favorite):  
  - `GET https://api.themoviedb.org/3/movie/{movie_id}/recommendations`  
  - `GET https://api.themoviedb.org/3/tv/{tv_id}/recommendations`

#### Flow
1. User provides favorite titles or IDs in the client.
2. (If needed) Convert titles to IDs using TMDB Search.
3. For each ID, retrieve recommendations using the endpoints above.
4. Aggregate results, remove duplicates, sort, and return to client.

### 2.2 API Authentication

- TMDB requires an **API key** (v3 auth) or **Bearer token** (v4 auth).
- **Store the API key in environment variables** (e.g., Vercel’s dashboard).
- Never expose the key in client-side code. Make requests via serverless functions to keep the key private.

### 2.3 Rate-Limiting & Performance

- TMDB’s free tier is relatively generous, but be mindful if each user has many favorites.
- Consider caching (e.g., in memory or using a small DB) to reduce calls.
- Throttle or limit the number of simultaneous requests if necessary.

---

## 3. User Input & Storage

### 3.1 Collecting Favorite Shows/Movies

- **Option A: Text Input**: User types the name of the show/movie, which is searched against TMDB.  
- **Option B: Autocomplete Search**: Show suggestions as the user types.  
- **Option C: Direct TMDB IDs**: More technical, less user-friendly.

**Recommendation**: Start with a **text input** that triggers a TMDB search, allowing the user to pick the correct item.

### 3.2 Data Storage

- **LocalStorage**: Simple for storing user preferences on a single device.  
- **Serverless DB** (like Firestore, Supabase) if you want user accounts and persistence across devices.  
- **JSON File**: Quick but not ideal for multi-user scenarios.

**Recommendation**: For an MVP, **LocalStorage** is sufficient. Expand to a persistent DB if you need multi-user support.

---

## 4. Recommendation Logic

1. **Fetch Recommendations for Each Favorite**  
   - For each TV show or movie ID, call the TMDB recommendation endpoint.
2. **Merge or Aggregate**  
   - Combine all recommendation results into one array or object.
   - Track how many times each recommendation appears (frequency).
3. **Sort or Rank**  
   - Sort by frequency (recommended by multiple favorites).
   - Secondary sort by popularity or rating to break ties.
4. **Handle Duplicates**  
   - Key recommendations by their TMDB ID. If an item appears multiple times, increment its count rather than adding a duplicate.

---

## 5. UI & User Experience

### 5.1 Basic Wireframe

1. **Header**: “TV & Movie Recommender”
2. **Input Section**: 
   - A search box or text input. 
   - An “Add to Favorites” button.
   - Display a list of current favorites.
3. **Recommendations Section**: 
   - A “Get Recommendations” button.
   - List/grid of recommended items, each with title, poster, rating, etc.
4. **Footer**: TMDB attribution, disclaimers.

### 5.2 Edge Case Handling

- **No Recommendations**: Display a clear message like “No recommendations found.”
- **Invalid Input**: Warn the user if nothing is found or if the search fails.
- **API Errors**: Gracefully handle timeouts or rate limits.

### 5.3 Optional Filters or Sorting

- Allow filtering by **genre**, **rating**, or **release date**.
- Let the user choose how to sort (popularity vs. rating vs. release date).

---

## 6. Security & Best Practices

1. **Hide the TMDB API Key** using environment variables on Vercel (e.g., `VERCEL_ENV`).
2. **Validate Input** from the user, especially if passing any parameters in serverless functions.
3. **HTTPS**: Vercel automatically handles HTTPS.
4. **Privacy**: If storing user data, provide a basic privacy policy or statement.

---

## 7. Sample Code or Pseudocode

Below is a simplified example using **serverless functions** on Vercel and a React front end.

### 7.1 Serverless Function (e.g., `api/recommendations.js`)

```js
// File: /api/recommendations.js

import axios from 'axios';

export default async function handler(req, res) {
  const { method } = req;

  // Your TMDB API key should be stored in an environment variable: process.env.TMDB_API_KEY
  const TMDB_API_KEY = process.env.TMDB_API_KEY;

  if (method === 'POST') {
    try {
      const { favorites } = req.body;
      if (!Array.isArray(favorites)) {
        return res.status(400).json({ error: 'favorites must be an array' });
      }

      let combinedResults = {};

      for (const fav of favorites) {
        const { type, id } = fav; // type: 'movie' or 'tv'
        const url = `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`;
        
        const response = await axios.get(url);
        const recs = response.data.results;

        recs.forEach(rec => {
          if (!combinedResults[rec.id]) {
            combinedResults[rec.id] = { ...rec, count: 1 };
          } else {
            combinedResults[rec.id].count += 1;
          }
        });
      }

      // Convert to array and sort
      const mergedArray = Object.values(combinedResults);

      // Sort primarily by count, then by popularity (descending)
      mergedArray.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.popularity - a.popularity;
      });

      return res.status(200).json(mergedArray);

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  } else {
    // Handle other HTTP methods if needed
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
