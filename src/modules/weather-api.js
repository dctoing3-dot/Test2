// src/modules/weather-api.js

const fetch = require('node-fetch');

class WeatherAPI {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENWEATHER_API_KEY;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    }

    async getCurrentWeather(city) {
        try {
            const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric&lang=id`;
            
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Kota tidak ditemukan');
                }
                throw new Error(`Weather API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
                city: data.name,
                country: data.sys.country,
                temp: Math.round(data.main.temp),
                feels_like: Math.round(data.main.feels_like),
                temp_min: Math.round(data.main.temp_min),
                temp_max: Math.round(data.main.temp_max),
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                weather: data.weather[0].description,
                weather_main: data.weather[0].main,
                icon: data.weather[0].icon,
                wind_speed: data.wind.speed,
                wind_deg: data.wind.deg,
                clouds: data.clouds.all,
                sunrise: new Date(data.sys.sunrise * 1000),
                sunset: new Date(data.sys.sunset * 1000),
                timezone: data.timezone
            };
        } catch (error) {
            console.error('Weather API error:', error.message);
            throw error;
        }
    }

    async getForecast(city, days = 5) {
        try {
            const url = `${this.baseUrl}/forecast?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric&lang=id`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Forecast API error: ${response.status}`);
            
            const data = await response.json();
            
            // Group by day
            const dailyForecasts = {};
            
            data.list.forEach(item => {
                const date = new Date(item.dt * 1000).toLocaleDateString('id-ID');
                
                if (!dailyForecasts[date]) {
                    dailyForecasts[date] = {
                        date: date,
                        temps: [],
                        weather: item.weather[0].description,
                        icon: item.weather[0].icon,
                        humidity: item.main.humidity,
                        wind_speed: item.wind.speed
                    };
                }
                
                dailyForecasts[date].temps.push(item.main.temp);
            });
            
            // Calculate avg temps
            const forecasts = Object.values(dailyForecasts).slice(0, days).map(day => ({
                ...day,
                temp_avg: Math.round(day.temps.reduce((a, b) => a + b) / day.temps.length),
                temp_min: Math.round(Math.min(...day.temps)),
                temp_max: Math.round(Math.max(...day.temps))
            }));
            
            return {
                city: data.city.name,
                country: data.city.country,
                forecasts
            };
        } catch (error) {
            console.error('Forecast API error:', error.message);
            throw error;
        }
    }

    getWeatherEmoji(weatherMain) {
        const emojiMap = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Drizzle': '🌦️',
            'Thunderstorm': '⛈️',
            'Snow': '❄️',
            'Mist': '🌫️',
            'Smoke': '💨',
            'Haze': '🌫️',
            'Dust': '💨',
            'Fog': '🌫️',
            'Sand': '💨',
            'Ash': '🌋',
            'Squall': '💨',
            'Tornado': '🌪️'
        };
        
        return emojiMap[weatherMain] || '🌡️';
    }

    getWindDirection(degrees) {
        const directions = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
        const index = Math.round(degrees / 45) % 8;
        return directions[index];
    }

    formatTime(date) {
        return date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Jakarta'
        });
    }
}

module.exports = WeatherAPI;
