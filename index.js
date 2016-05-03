var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');
var inquirer = require('inquirer');
var chalk = require('chalk');
var dateFormat = require('dateformat');

var axios = require('axios');
var Promise = require('bluebird');
var cheerio = require('cheerio');
var Table = require('cli-table');


var baseUrl = 'https://www.cgvblitz.com/en/schedule/cinema';
var seatUrl = 'https://www.cgvblitz.com/en/schedule/seat';
var model = [];
var cities = [];
var cinemas = [];
var movies = [];
var currentCinema = {};
var currentMovie = {};
var currentType = {};
var currentTime = {};

console.log('Welcome to CGV Blitz CLI.\nPlease wait while we are initializing the app.');

axios.get(baseUrl).then(function(response) {
    var $ = cheerio.load(response.data);
    $('.city').each(function (i, elm) {
        var city = $(elm).children().first().text();
        var cinemasObject = $(elm).children().eq(1).children().first().children();
        var cinemas = [];
        cinemasObject.each(function(i, elm) {
            cinemas.push({
                name: $(elm).first().text(),
                id: $(elm).first().children().first().attr('id')
            });
        });
        model.push({
            city: city,
            cinemas: cinemas
        });
        cities.push(city);
    });

    return cities;
}).then(function(cities) {
    return inquirer.prompt([{
        type      : 'list',
        name      : 'city',
        message   : 'Please choose your city',
        choices   : cities
    }])
}).then(function (answers) {
    var currentCity = cities[cities.indexOf(answers.city)];
    cinemas = model.filter(function(item) {
        return item.city == currentCity;
    })[0]['cinemas'];

    return inquirer.prompt([{
        type  : 'list',
        name  : 'cinema',
        message : 'Please choose a cinema in ' + cities[cities.indexOf(answers.city)],
        choices : cinemas
    }]);
}).then(function (answers) {
    currentCinema = cinemas.filter(function(item) {
        return item.name == answers.cinema;
    })[0];
    console.log('Please wait while loading movies...');
    return axios.get(baseUrl + '/' + currentCinema.id);
}).then(function (response) {
    var $ = cheerio.load(response.data);
    $('.schedule-title').each(function (i, elm) {
        var title = $(elm).children().first().text();
        var idObject = $(elm).children().first().attr('href').split('/');
        var typesObject = $(elm).parent().find('.schedule-type');
        types = [];
        typesObject.each(function(i, elm) {
            var timesObject = $(elm).next().find('.showtime-lists').children();
            var times = [];
            timesObject.each(function(i, elm) {
                times.push({
                    name: $(elm).text(),
                    price: $(elm).first().children().first().attr('price')
                });
            });
            types.push({
                name: $(elm).text().trim(),
                times: times
            });
        });

        movies.push({
            name: title,
            id: idObject[idObject.length - 1],
            types: types
        });
    });

    return inquirer.prompt([{
        type  : 'list',
        name  : 'movie',
        message : 'Please choose a movie ',
        choices : movies
    }]);
}).then(function (answers) {
    currentMovie = movies.filter(function(item) {
        return item.name == answers.movie;
    })[0];
    return inquirer.prompt([{
        type  : 'list',
        name  : 'type',
        message : 'Please choose a type ',
        choices : currentMovie.types
    }]);
}).then(function (answers) {
    currentType = currentMovie.types.filter(function(item) {
        return item.name == answers.type;
    })[0];
    return inquirer.prompt([{
        type  : 'list',
        name  : 'time',
        message : 'Please choose a time ',
        choices : currentType.times
    }]);
}).then(function (answers) {
    currentTime = currentType.times.filter(function(item) {
        return item.name == answers.time;
    })[0];
    console.log('Please wait while loading seats...');
    var movieformat = currentType.name.split(' ');
    var time = currentTime.name;
    var price = currentTime.price;
    return axios.get(seatUrl + '?cinema=' + currentCinema.id + '&showdate=' + dateFormat(new Date(), 'yyyy-mm-dd') + '&movie=' + currentMovie.id + '&auditype=N&showtime=' + time + '&movieformat=' + movieformat[1] + '&price=' + price + '&loveseatprice=0&price1=0&price2=0&price3=0&price4=0&price5=0');
}).then(function (response) {
    var head = [];
    var body = [];

    var $ = cheerio.load(response.data);
    var rowCount = 0;
    var columnCount = 0;
    var seatRows = [];
    $('.seat-row').each(function (i, elm) {
        rowCount++;
        var seatColumns = [];
        $(elm).children().each(function(i, elm) {
            var statusObject = $(elm).children().first().attr('class');
            var taken = false;
            if (statusObject) {
                statusObject = statusObject.split(' ');
                taken = (statusObject[1] == 'taken');
            }
            seatColumns.push({
                label: $(elm).text().trim(),
                taken: taken
            });
        });
        seatRows.push(seatColumns);
    });

    columnCount = seatRows[0].length - 1;

    for (var i = 0; i <= columnCount; i++) {
        head.push(i);
    }
    
    var table = new Table({
        head: head
    });

    for (var i = rowCount - 1; i >= 1; i--) {
        var first = [String.fromCharCode(64 + i)];
        var currentRow = seatRows[i - 1];
        currentRow = currentRow.map(function(item) {
            if (!item.taken)
                return item.label;
            else
                return 'x';
        });
        currentRow = currentRow.reverse();
        currentRow.shift()
        table.push(first.concat(currentRow));
    }

    console.log(' ==== screen here ==== ');
    console.log(table.toString());
    console.log(' Date         : ' + dateFormat(new Date(), 'yyyy-mm-dd'));
    console.log(' Ticket Price : ' + currentTime.price);
});

