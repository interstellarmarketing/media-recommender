class RecommendationEngine {
  constructor(userPreferences = {}) {
    this.weights = {
      directRecommendation: 1.0,
      similar: 0.8,
      keyword: 0.6,
      castCrew: 0.5,
      popularity: 0.3,
      voteAverage: 0.4,
      genreMatch: 0.7,
      yearProximity: 0.2
    };
    this.userPreferences = userPreferences;
  }

  async getEnhancedRecommendations(movieIds) {
    const recommendations = [];
    
    for (const movieId of movieIds) {
      // Fetch data from multiple sources
      const [direct, similar, keywords, credits] = await Promise.all([
        this.fetchRecommendations(movieId),
        this.fetchSimilar(movieId),
        this.fetchKeywords(movieId),
        this.fetchCredits(movieId)
      ]);

      // Process each source
      recommendations.push(
        ...this.processDirectRecommendations(direct),
        ...this.processSimilarMovies(similar),
        ...this.processKeywordBasedMovies(keywords),
        ...this.processCastCrewMovies(credits)
      );
    }

    return this.rankAndDeduplicate(recommendations);
  }

  calculateScore(movie, source, baseMovie) {
    let score = 0;

    // Base score from source
    switch(source) {
      case 'direct':
        score += this.weights.directRecommendation;
        break;
      case 'similar':
        score += this.weights.similar;
        break;
      case 'keyword':
        score += this.weights.keyword;
        break;
      case 'castCrew':
        score += this.weights.castCrew;
        break;
    }

    // Popularity factor (normalized to 0-1)
    score += (movie.popularity / 100) * this.weights.popularity;

    // Vote average factor
    score += (movie.vote_average / 10) * this.weights.voteAverage;

    // Genre match factor
    const genreMatchScore = this.calculateGenreMatchScore(movie.genre_ids, baseMovie.genre_ids);
    score += genreMatchScore * this.weights.genreMatch;

    // Year proximity factor
    const yearProximityScore = this.calculateYearProximityScore(
      movie.release_date,
      baseMovie.release_date
    );
    score += yearProximityScore * this.weights.yearProximity;

    return score;
  }

  calculateGenreMatchScore(genres1, genres2) {
    const intersection = genres1.filter(g => genres2.includes(g));
    return intersection.length / Math.max(genres1.length, genres2.length);
  }

  calculateYearProximityScore(date1, date2) {
    const year1 = new Date(date1).getFullYear();
    const year2 = new Date(date2).getFullYear();
    const yearDiff = Math.abs(year1 - year2);
    return Math.max(0, 1 - yearDiff / 10); // Normalize difference over 10 years
  }

  rankAndDeduplicate(recommendations) {
    // Group by movie ID and combine scores
    const merged = new Map();
    
    recommendations.forEach(rec => {
      if (merged.has(rec.id)) {
        const existing = merged.get(rec.id);
        existing.score = (existing.score + rec.score) / 2;
        existing.sources.push(rec.source);
        existing.frequency++;
      } else {
        merged.set(rec.id, {
          ...rec,
          sources: [rec.source],
          frequency: 1
        });
      }
    });

    // Convert to array and sort by score
    return Array.from(merged.values())
      .sort((a, b) => {
        // Primary sort by score
        if (b.score !== a.score) return b.score - a.score;
        // Secondary sort by frequency
        return b.frequency - a.frequency;
      })
      // Apply user preferences filters
      .filter(movie => this.applyUserPreferences(movie));
  }

  applyUserPreferences(movie) {
    const { minYear, maxYear, excludedGenres, minRating } = this.userPreferences;
    
    const year = new Date(movie.release_date).getFullYear();
    
    if (minYear && year < minYear) return false;
    if (maxYear && year > maxYear) return false;
    if (excludedGenres && movie.genre_ids.some(g => excludedGenres.includes(g))) return false;
    if (minRating && movie.vote_average < minRating) return false;
    
    return true;
  }
}