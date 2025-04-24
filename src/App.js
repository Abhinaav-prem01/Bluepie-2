import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import axios from 'axios';
import './App.css';

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 200px)'
};

// Common grocery items and their categories
const GROCERY_CATEGORIES = {
  fruits: ['apple', 'orange', 'banana', 'grapes', 'mango', 'strawberry', 'blueberry'],
  vegetables: ['carrot', 'potato', 'tomato', 'lettuce', 'onion', 'broccoli'],
  snacks: ['chips', 'cookies', 'chocolate', 'nuts', 'candy'],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'eggs'],
  meat: ['chicken', 'beef', 'pork', 'fish', 'lamb'],
  bakery: ['bread', 'cake', 'pastry', 'donut', 'muffin']
};

// Major supermarket chains
const SUPERMARKET_CHAINS = [
  'coles',
  'woolworths',
  'aldi',
  'iga',
  'foodworks',
  'spudshed',
  'harris farm'
];

// Sort options
const SORT_OPTIONS = {
  distance: 'Distance (Nearest)',
  price: 'Price (Low to High)',
  rating: 'Rating (Highest)'
};

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [center, setCenter] = useState({ lat: -33.8688, lng: 151.2093 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [sortBy, setSortBy] = useState('distance');
  const [priceFilter, setPriceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [mapError, setMapError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviews, setReviews] = useState(() => {
    const savedReviews = localStorage.getItem('groceryReviews');
    return savedReviews ? JSON.parse(savedReviews) : [];
  });

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ['places']
  });

  useEffect(() => {
    if (loadError) {
      setMapError('Error loading Google Maps. Please check your API key.');
    }
  }, [loadError]);

  const onLoad = useCallback(function callback(map) {
    // Map is loaded
  }, []);

  const onUnmount = useCallback(function callback() {
    // Map is unmounted
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCenter(newCenter);
          setLoading(false);
        },
        (error) => {
          setError('Error getting location: ' + error.message);
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  };

  const determineCategory = (searchTerm) => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // Check if it's a supermarket chain
    if (SUPERMARKET_CHAINS.some(chain => lowerSearchTerm.includes(chain))) {
      return 'supermarket';
    }

    // Check grocery categories
    for (const [cat, items] of Object.entries(GROCERY_CATEGORIES)) {
      if (items.some(item => lowerSearchTerm.includes(item))) {
        return cat;
      }
    }

    return 'grocery'; // Default category
  };

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

  const searchGroceryItems = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    if (!center.lat || !center.lng) {
      setError('Please get your location first');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedStore(null);
    setResults([]);
    setFilteredResults([]);

    try {
      const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_YELP_API_KEY}`
        },
        params: {
          term: searchTerm,
          latitude: center.lat,
          longitude: center.lng,
          radius: 5000, // Increased radius to 5km
          categories: 'grocery,supermarkets,food',
          sort_by: sortBy,
          limit: 20
        }
      });

      const businesses = response.data.businesses.map(business => ({
        ...business,
        distance: business.distance / 1000, // Convert to kilometers
        price_level: business.price ? business.price.length : 0
      }));

      setResults(businesses);
      setFilteredResults(applyFilters(businesses));
      setError('');
    } catch (error) {
      console.error('Search error:', error);
      setError('Error searching for stores. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim() && center.lat && center.lng) {
        searchGroceryItems();
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [searchTerm, center, sortBy, priceFilter, ratingFilter]);

  useEffect(() => {
    if (results.length > 0) {
      setFilteredResults(applyFilters(results));
    }
  }, [results, applyFilters]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    localStorage.setItem('groceryReviews', JSON.stringify(reviews));
  }, [reviews]);

  const calculateAverageRating = (storeId) => {
    const storeReviews = reviews.filter(review => review.storeId === storeId);
    if (storeReviews.length === 0) return 0;
    const sum = storeReviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / storeReviews.length).toFixed(1);
  };

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
      setReviews(prevReviews => [...prevReviews, newReview]);
      setReviewText('');
      setReviewRating(5);
      setShowReviewForm(false);
    }
  };

  const getStoreReviews = (storeId) => {
    return reviews.filter(review => review.storeId === storeId);
  };

  const renderStoreInfo = (store) => {
    const storeReviews = getStoreReviews(store.id);
    const averageRating = calculateAverageRating(store.id);
    
    return (
      <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg`}>
        <h3 className="text-xl font-bold mb-2">{store.name}</h3>
        <div className="flex items-center mb-2">
          <span className="mr-2">Average Rating:</span>
          <div className="flex items-center">
            <span className="text-yellow-400 mr-1">★</span>
            <span>{averageRating}</span>
            <span className="text-gray-500 ml-1">({storeReviews.length} reviews)</span>
          </div>
        </div>
        <p className="text-gray-500 mb-2">{store.location.address1}</p>
        <p className="text-gray-500 mb-2">{store.distance.toFixed(1)} km away</p>
        {store.price && <p className="text-gray-500 mb-2">Price Level: {store.price}</p>}
        <button
          onClick={() => setShowReviewForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Write a Review
        </button>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="max-w-4xl mx-auto">
        <div className={`p-4 shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center justify-center mb-4 relative">
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>BluePie</h1>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg absolute right-0 ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
          
          <div className={`rounded-lg shadow-md p-4 mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for grocery items or stores..."
                  className={`flex-1 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && searchGroceryItems()}
                />
                <button
                  onClick={getCurrentLocation}
                  className={`px-6 py-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : '📍 Get Location'}
                </button>
                <button
                  onClick={searchGroceryItems}
                  className={`px-6 py-3 rounded-lg transition-colors ${
                    isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                  disabled={loading}
                >
                  {loading ? 'Searching...' : '🔍 Search'}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-4">
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
                    <option value="all" className="bg-gray-700">All Prices</option>
                    <option value="1" className="bg-gray-700">$</option>
                    <option value="2" className="bg-gray-700">$$</option>
                    <option value="3" className="bg-gray-700">$$$</option>
                    <option value="4" className="bg-gray-700">$$$$</option>
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
                    <option value="all" className="bg-gray-700">All Ratings</option>
                    <option value="4.5" className="bg-gray-700">4.5+ ⭐</option>
                    <option value="4.0" className="bg-gray-700">4.0+ ⭐</option>
                    <option value="3.5" className="bg-gray-700">3.5+ ⭐</option>
                    <option value="3.0" className="bg-gray-700">3.0+ ⭐</option>
                  </select>
                </div>
              </div>

              <div className="text-sm text-gray-400">
                <p>Try searching for: fruits (apple, orange), vegetables, snacks, or supermarket names (Coles, Woolworths)</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-900 text-white p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          {isLoaded && !mapError && (
            <div className="bg-gray-700 rounded-lg shadow-md p-4 mb-4">
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={13}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                  styles: [
                    {
                      "featureType": "all",
                      "elementType": "labels.text.fill",
                      "stylers": [
                        {
                          "color": "#ffffff"
                        }
                      ]
                    },
                    {
                      "featureType": "all",
                      "elementType": "labels.text.stroke",
                      "stylers": [
                        {
                          "visibility": "on"
                        },
                        {
                          "color": "#000000"
                        },
                        {
                          "weight": 2
                        }
                      ]
                    },
                    {
                      "featureType": "all",
                      "elementType": "labels.icon",
                      "stylers": [
                        {
                          "visibility": "off"
                        }
                      ]
                    },
                    {
                      "featureType": "administrative",
                      "elementType": "geometry.fill",
                      "stylers": [
                        {
                          "color": "#000000"
                        }
                      ]
                    },
                    {
                      "featureType": "administrative",
                      "elementType": "geometry.stroke",
                      "stylers": [
                        {
                          "color": "#144b53"
                        },
                        {
                          "weight": 1
                        }
                      ]
                    },
                    {
                      "featureType": "landscape",
                      "elementType": "all",
                      "stylers": [
                        {
                          "color": "#08304b"
                        }
                      ]
                    },
                    {
                      "featureType": "poi",
                      "elementType": "geometry",
                      "stylers": [
                        {
                          "color": "#0c4152"
                        }
                      ]
                    },
                    {
                      "featureType": "road.highway",
                      "elementType": "geometry.fill",
                      "stylers": [
                        {
                          "color": "#000000"
                        }
                      ]
                    },
                    {
                      "featureType": "road.highway",
                      "elementType": "geometry.stroke",
                      "stylers": [
                        {
                          "color": "#0b434f"
                        }
                      ]
                    },
                    {
                      "featureType": "road.arterial",
                      "elementType": "geometry.fill",
                      "stylers": [
                        {
                          "color": "#000000"
                        }
                      ]
                    },
                    {
                      "featureType": "road.arterial",
                      "elementType": "geometry.stroke",
                      "stylers": [
                        {
                          "color": "#0b3d51"
                        }
                      ]
                    },
                    {
                      "featureType": "road.local",
                      "elementType": "geometry",
                      "stylers": [
                        {
                          "color": "#000000"
                        }
                      ]
                    },
                    {
                      "featureType": "transit",
                      "elementType": "all",
                      "stylers": [
                        {
                          "color": "#146474"
                        }
                      ]
                    },
                    {
                      "featureType": "water",
                      "elementType": "all",
                      "stylers": [
                        {
                          "color": "#021019"
                        }
                      ]
                    }
                  ]
                }}
              >
                {filteredResults.map((business) => (
                  <Marker
                    key={business.id}
                    position={{
                      lat: business.coordinates.latitude,
                      lng: business.coordinates.longitude
                    }}
                    onClick={() => setSelectedStore(business)}
                    icon={{
                      url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                    }}
                  />
                ))}
                
                {selectedStore && (
                  <InfoWindow
                    position={{
                      lat: selectedStore.coordinates.latitude,
                      lng: selectedStore.coordinates.longitude
                    }}
                    onCloseClick={() => setSelectedStore(null)}
                  >
                    {renderStoreInfo(selectedStore)}
                  </InfoWindow>
                )}
              </GoogleMap>
            </div>
          )}

          <div className="mt-4">
            {filteredResults.map((business) => (
              <div 
                key={business.id} 
                className="bg-gray-700 rounded-lg p-4 mb-4 hover:bg-gray-600 cursor-pointer transition-colors" 
                onClick={() => setSelectedStore(business)}
              >
                <h3 className="text-xl font-semibold text-blue-400">{business.name}</h3>
                <p className="text-gray-300">{business.location.address1}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-yellow-400">⭐ {business.rating}</span>
                  <span className="text-green-400">💰 {business.price || 'N/A'}</span>
                  <span className="text-gray-400">📍 {(business.distance / 1000).toFixed(1)} km</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedStore && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}>
          <div className={`p-6 rounded-lg max-w-md w-full mx-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {selectedStore.name}
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
                {selectedStore.vicinity || selectedStore.formatted_address}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-yellow-400">⭐ {selectedStore.rating || 'N/A'}</span>
                {selectedStore.price_level && (
                  <span className="ml-2 text-green-400">
                    {'$'.repeat(selectedStore.price_level)}
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
              {getStoreReviews(selectedStore.id).length > 0 ? (
                getStoreReviews(selectedStore.id).map((review) => (
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
                        {review.date}
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
        </div>
      )}
    </div>
  );
}

export default App; 