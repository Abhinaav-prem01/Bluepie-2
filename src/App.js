import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 200px)'
};

// Store categories and their keywords
const STORE_CATEGORIES = {
  grocery: {
    keywords: ['supermarket', 'grocery', 'convenience store', 'food store'],
    items: ['apple', 'banana', 'milk', 'bread', 'eggs', 'vegetables', 'fruits']
  },
  clothing: {
    keywords: ['clothing store', 'fashion', 'apparel', 'shoes', 'footwear'],
    items: ['shoes', 'clothes', 'dress', 'shirt', 'pants', 'jacket']
  },
  electronics: {
    keywords: ['electronics store', 'phone store', 'computer store', 'gadget shop'],
    items: ['phone', 'laptop', 'computer', 'headphones', 'camera', 'tv']
  },
  home: {
    keywords: ['furniture store', 'home goods', 'household', 'homeware'],
    items: ['furniture', 'sofa', 'table', 'chair', 'bed', 'decor']
  },
  beauty: {
    keywords: ['beauty store', 'cosmetics', 'perfume', 'makeup'],
    items: ['makeup', 'perfume', 'skincare', 'cosmetics', 'beauty products']
  },
  sports: {
    keywords: ['sports store', 'fitness', 'sporting goods', 'gym equipment'],
    items: ['sports equipment', 'fitness gear', 'gym clothes', 'sports shoes']
  },
  books: {
    keywords: ['bookstore', 'books', 'stationery', 'office supplies'],
    items: ['books', 'stationery', 'pens', 'notebooks', 'magazines']
  },
  toys: {
    keywords: ['toy store', 'games', 'toys', 'hobby shop'],
    items: ['toys', 'games', 'puzzles', 'board games', 'hobby items']
  }
};

// Sort options
const SORT_OPTIONS = {
  distance: 'Distance (Nearest)',
  price: 'Price (Low to High)',
  rating: 'Rating (Highest)'
};

// Search helper suggestions
const SEARCH_SUGGESTIONS = {
  grocery: {
    items: ['fruits', 'vegetables', 'dairy', 'meat', 'bakery', 'snacks'],
    stores: ['supermarket', 'grocery store', 'convenience store', 'farmers market']
  },
  electronics: {
    items: ['phones', 'laptops', 'computers', 'headphones', 'cameras'],
    stores: ['electronics store', 'phone store', 'computer shop', 'gadget store']
  },
  clothing: {
    items: ['shoes', 'clothes', 'accessories', 'jewelry', 'bags'],
    stores: ['clothing store', 'shoe store', 'fashion boutique', 'department store']
  }
};

// Helper function to calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [center, setCenter] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState(null);
  const [sortBy, setSortBy] = useState('distance');
  const [priceFilter, setPriceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviews, setReviews] = useState([]);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Function to update map center
  function ChangeView({ center }) {
    const map = useMap();
    if (center) {
      map.setView(center);
    }
    return null;
  }

  // Move getSearchSuggestions before its usage
  const getSearchSuggestions = useCallback((term) => {
    if (!term.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const suggestions = [];
    const lowerTerm = term.toLowerCase();

    // Add category-based suggestions
    Object.entries(SEARCH_SUGGESTIONS).forEach(([category, data]) => {
      data.items.forEach(item => {
        if (item.includes(lowerTerm)) {
          suggestions.push({
            type: 'item',
            category,
            text: item
          });
        }
      });
      data.stores.forEach(store => {
        if (store.includes(lowerTerm)) {
          suggestions.push({
            type: 'store',
            category,
            text: store
          });
        }
      });
    });

    // Add common search terms
    const commonTerms = ['near me', 'closest', 'best rated', 'cheapest'];
    commonTerms.forEach(term => {
      if (term.includes(lowerTerm)) {
        suggestions.push({
          type: 'modifier',
          text: term
        });
      }
    });

    setSearchSuggestions(suggestions.slice(0, 5));
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = [position.coords.latitude, position.coords.longitude];
          setCenter(newCenter);
          setLoading(false);
          setLocationPermission('granted');
        },
        (error) => {
          setError('Error getting location: ' + error.message);
          setLoading(false);
          setLocationPermission('denied');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setLocationPermission('denied');
    }
  }, []);

  const determineCategory = useCallback((searchTerm) => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    for (const [category, data] of Object.entries(STORE_CATEGORIES)) {
      if (data.items.some(item => lowerSearchTerm.includes(item))) {
        return category;
      }
    }
    
    return 'all';
  }, []);

  const applyFilters = useMemo(() => {
    return (results) => {
      let filtered = [...results];

      if (priceFilter !== 'all') {
        filtered = filtered.filter(business => {
          const priceLevel = business.price ? business.price.length : 0;
          return priceLevel <= parseInt(priceFilter);
        });
      }

      if (ratingFilter !== 'all') {
        filtered = filtered.filter(business => business.rating >= parseFloat(ratingFilter));
      }

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'distance':
            return a.distance - b.distance;
          case 'price':
            const priceA = a.price ? a.price.length : 4;
            const priceB = b.price ? b.price.length : 4;
            return priceA - priceB;
          case 'rating':
            return b.rating - a.rating;
          default:
            return 0;
        }
      });

      return filtered;
    };
  }, [sortBy, priceFilter, ratingFilter]);

  const searchStores = useCallback(async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    if (!center) {
      setError('Please allow location access first');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedStore(null);
    setResults([]);
    setFilteredResults([]);

    try {
      const category = determineCategory(searchTerm);
      setSelectedCategory(category);

      // Build search query based on category and search term
      let searchQuery = searchTerm;
      if (category !== 'all') {
        const categoryKeywords = STORE_CATEGORIES[category].keywords;
        searchQuery = `${searchTerm} ${categoryKeywords.join(' OR ')}`;
      }

      // Add location context to improve search results
      const [lat, lng] = center;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=30&bounded=1&viewbox=${lng-0.01},${lat+0.01},${lng+0.01},${lat-0.01}&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const stores = data.map(place => ({
          id: place.place_id,
          name: place.display_name.split(',')[0],
          rating: Math.random() * 2 + 3,
          price: '$'.repeat(Math.floor(Math.random() * 3) + 1),
          distance: calculateDistance(
            lat,
            lng,
            parseFloat(place.lat),
            parseFloat(place.lon)
          ),
          coordinates: {
            latitude: parseFloat(place.lat),
            longitude: parseFloat(place.lon)
          },
          vicinity: place.display_name,
          category: category,
          reviews: [],
          type: place.type || 'store',
          address: place.address || {}
        }));

        // Filter results within 1km radius
        let nearbyStores = stores.filter(store => store.distance <= 1);
        
        // If no results within 1km, expand search radius to 2km
        if (nearbyStores.length === 0) {
          nearbyStores = stores.filter(store => store.distance <= 2);
          if (nearbyStores.length > 0) {
            setAssistantMessage("I found some stores within 2km. Would you like me to show you the closest options?");
            setShowAssistant(true);
          }
        }
        
        if (nearbyStores.length > 0) {
          setResults(nearbyStores);
          setFilteredResults(applyFilters(nearbyStores));
          setError('');
        } else {
          // If still no results, show the closest 5 stores regardless of distance
          const closestStores = stores
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
          setResults(closestStores);
          setFilteredResults(applyFilters(closestStores));
          setAssistantMessage("I couldn't find any stores nearby, but here are the closest options. Would you like me to help you find alternatives?");
          setShowAssistant(true);
        }
      } else {
        setError('No results found. Try searching for a different item or location.');
        setAssistantMessage("I couldn't find any results. Would you like me to suggest some alternative search terms?");
        setShowAssistant(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Error searching for stores. Please try again.');
      setAssistantMessage("I encountered an error. Would you like me to help you troubleshoot?");
      setShowAssistant(true);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, center, determineCategory, applyFilters, setSelectedCategory, setError, setLoading, setSelectedStore, setResults, setFilteredResults, setAssistantMessage, setShowAssistant]);

  // Update search suggestions when search term changes
  useEffect(() => {
    getSearchSuggestions(searchTerm);
  }, [searchTerm, getSearchSuggestions]);

  // Initial location fetch
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Update filtered results when filters change
  useEffect(() => {
    if (results.length > 0) {
      setFilteredResults(applyFilters(results));
    }
  }, [results, applyFilters]);

  // Handle search button click
  const handleSearch = useCallback(() => {
    if (searchTerm.trim() && center) {
      searchStores();
    }
  }, [searchTerm, center, searchStores]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (reviewText.trim()) {
      const newReview = {
        id: Date.now(),
        text: reviewText,
        rating: reviewRating,
        date: new Date().toLocaleDateString(),
        storeId: selectedStore?.id
      };
      setReviews([...reviews, newReview]);
      setReviewText('');
      setReviewRating(5);
      setShowReviewForm(false);
    }
  };

  const renderStoreDetails = (store) => {
    const storeReviews = reviews.filter(review => review.storeId === store.id);
    return (
      <div className={`p-6 rounded-lg max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex justify-between items-start mb-4">
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {store.name}
          </h3>
          <button
            onClick={() => setSelectedStore(null)}
            className={`p-2 rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
            {store.vicinity}
          </p>
          {store.phone_number && (
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              📞 {store.phone_number}
            </p>
          )}
          {store.website && (
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              🌐 <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                Visit Website
              </a>
            </p>
          )}
          <div className="flex items-center mt-2">
            <span className="text-yellow-400">⭐ {store.rating.toFixed(1)}</span>
            {store.price && (
              <span className="ml-2 text-green-400">
                {store.price}
              </span>
            )}
          </div>
        </div>

        {!showReviewForm ? (
          <button
            onClick={() => setShowReviewForm(true)}
            className={`w-full py-2 rounded-lg mb-4 ${
              isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          >
            Write a Review
          </button>
        ) : (
          <form onSubmit={handleReviewSubmit} className="mb-4">
            <div className="mb-4">
              <label className={`block mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Rating
              </label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`text-2xl ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-400'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write your review..."
                className={`w-full p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'
                }`}
                rows="4"
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className={`flex-1 py-2 rounded-lg ${
                  isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                } text-white`}
              >
                Submit Review
              </button>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className={`flex-1 py-2 rounded-lg ${
                  isDarkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-4">
          <h4 className={`font-bold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Reviews
          </h4>
          {storeReviews.length > 0 ? (
            storeReviews.map((review) => (
              <div
                key={review.id}
                className={`p-3 rounded-lg mb-2 ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}
              >
                <div className="flex items-center mb-1">
                  <span className="text-yellow-400 mr-2">
                    {'⭐'.repeat(review.rating)}
                  </span>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {review.author} • {review.date}
                  </span>
                </div>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {review.text}
                </p>
              </div>
            ))
          ) : (
            <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
              No reviews yet. Be the first to review!
            </p>
          )}
        </div>
      </div>
    );
  };

  const handleAssistantResponse = useCallback((response) => {
    setIsTyping(true);
    setTimeout(() => {
      setAssistantMessage(response);
      setIsTyping(false);
    }, 1000);
  }, []);

  // Function to handle suggestion click
  const handleSuggestionClick = useCallback((suggestion) => {
    let newSearchTerm = searchTerm;
    
    if (suggestion.type === 'item' || suggestion.type === 'store') {
      newSearchTerm = suggestion.text;
    } else if (suggestion.type === 'modifier') {
      newSearchTerm = `${searchTerm} ${suggestion.text}`;
    }

    setSearchTerm(newSearchTerm);
    setShowSuggestions(false);
    handleSearch();
  }, [searchTerm, handleSearch]);

  // Function to handle marker click
  const handleMarkerClick = useCallback((store) => {
    setSelectedStore(store);
  }, []);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center mb-4 relative">
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>BluePie</h1>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg absolute right-0 ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
          
          {locationPermission === 'denied' && (
            <div className="bg-yellow-900 text-white p-4 rounded-lg mb-4">
              Please enable location access to find stores near you.
            </div>
          )}

          <div className={`rounded-lg shadow-md p-4 mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex flex-col gap-4">
              <div className="relative max-w-3xl mx-auto w-full">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search for items or stores..."
                  className={`w-full p-4 pl-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 rounded-lg ${
                    isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                  disabled={loading}
                >
                  {loading ? '🔍' : 'Search'}
                </button>
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className={`absolute z-50 w-full mt-1 rounded-lg shadow-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-white'
                  }`}>
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`w-full text-left px-4 py-2 hover:bg-blue-500 hover:text-white ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        <span className="flex items-center">
                          {suggestion.type === 'item' && '🛍️ '}
                          {suggestion.type === 'store' && '🏪 '}
                          {suggestion.type === 'modifier' && '🔍 '}
                          {suggestion.text}
                          {suggestion.category && (
                            <span className="ml-2 text-sm text-gray-400">
                              ({suggestion.category})
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap gap-4 justify-center">
                  <div className="flex items-center gap-2">
                    <label className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Category:</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                      }`}
                    >
                      <option value="all">All Categories</option>
                      {Object.entries(STORE_CATEGORIES).map(([category, data]) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                      }`}
                    >
                      {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Price:</label>
                    <select
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value)}
                      className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                      }`}
                    >
                      <option value="all">All Prices</option>
                      <option value="1">$</option>
                      <option value="2">$$</option>
                      <option value="3">$$$</option>
                      <option value="4">$$$$</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Rating:</label>
                    <select
                      value={ratingFilter}
                      onChange={(e) => setRatingFilter(e.target.value)}
                      className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                      }`}
                    >
                      <option value="all">All Ratings</option>
                      <option value="4.5">4.5+ ⭐</option>
                      <option value="4.0">4.0+ ⭐</option>
                      <option value="3.5">3.5+ ⭐</option>
                      <option value="3.0">3.0+ ⭐</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-900 text-white p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          {showAssistant && (
            <div className={`fixed bottom-4 right-4 max-w-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-4`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-blue-400">AI Assistant</h3>
                <button
                  onClick={() => setShowAssistant(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {isTyping ? '...' : assistantMessage}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAssistantResponse("I'll help you find alternatives. What type of items are you looking for?")}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                >
                  Help me
                </button>
                <button
                  onClick={() => setShowAssistant(false)}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {center && (
            <div className="bg-gray-700 rounded-lg shadow-md p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <button
                  onClick={() => setIsSatelliteView(!isSatelliteView)}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                >
                  {isSatelliteView ? '🗺️ Normal View' : '🛰️ Satellite View'}
                </button>
              </div>
              <MapContainer
                center={center}
                zoom={15}
                style={containerStyle}
                scrollWheelZoom={true}
                zoomControl={false}
              >
                <ChangeView center={center} />
                <ZoomControl position="bottomright" />
                {isSatelliteView ? (
                  <TileLayer
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                ) : (
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                )}
                <Circle
                  center={center}
                  radius={1000}
                  pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
                />
                {filteredResults.map((store) => (
                  <Marker
                    key={store.id}
                    position={[store.coordinates.latitude, store.coordinates.longitude]}
                    eventHandlers={{
                      click: () => handleMarkerClick(store),
                    }}
                  >
                    <Popup>
                      <div className="bg-gray-800 text-white p-2">
                        <h3 className="font-bold text-blue-400">{store.name}</h3>
                        <p className="text-sm text-gray-400">{store.category}</p>
                        <p>⭐ {store.rating.toFixed(1)}</p>
                        <p>💰 {store.price}</p>
                        <p>📍 {(store.distance * 1000).toFixed(0)} m</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          <div className="mt-4">
            {filteredResults.map((store) => (
              <div 
                key={store.id} 
                className="bg-gray-700 rounded-lg p-4 mb-4 hover:bg-gray-600 cursor-pointer transition-colors" 
                onClick={() => setSelectedStore(store)}
              >
                <h3 className="text-xl font-semibold text-blue-400">{store.name}</h3>
                <p className="text-sm text-gray-400">{store.category}</p>
                <p className="text-gray-300">{store.vicinity}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-yellow-400">⭐ {store.rating.toFixed(1)}</span>
                  <span className="text-green-400">💰 {store.price}</span>
                  <span className="text-gray-400">📍 {(store.distance * 1000).toFixed(0)} m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedStore && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}>
          {renderStoreDetails(selectedStore)}
        </div>
      )}
    </div>
  );
}

export default App; 