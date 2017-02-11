// // Reactrouter was imported via cdn - defining often-used react-router variables here
import {Router, Route, browserHistory, Link, withRouter} from 'react-router';
import LandingPage from './landingPage';
import ProfilePage from './profilePage';
import Ranked from './ranked';
import Unranked from './unranked';
import App from './app';
import MazeStore from './store';
import ReactDOM from 'react-dom';
import React from 'react';
import MultiplayerMazeRunner from './multiplayerMazeRunner';
import MultiplayerRanked from './multiplayerRanked';
import MultiplayerCustom from './multiplayerCustom';
import MazeRunner from './mazeRunner';
import ResetPassword from './resetPassword';
import About from './about';



function requireAuth() {
    $.ajax({
        type: 'GET',
        url: '/verifytoken',
        async: false,
        headers: {'x-access-token': document.cookie},
        data: {username: localStorage.getItem('username')},
        success: function(data) {
            if (data.success) {
                console.log(data.message);
            } else {
                console.log(data.message);
                browserHistory.replace('/')
            }
        }.bind(this),
        error: function(data) {
            console.log('data', data);
            browserHistory.replace({pathname: '/'})
        }.bind(this)
    })
}

function checkAuth() {
    $.ajax({
        type: 'GET',
        url: '/verifytoken',
        headers: {'x-access-token': document.cookie},
        data: {username: localStorage.getItem('username')},
        async: false,
        success: function(data) {
            if (data.success) {
                browserHistory.replace('/profile');
            }
        },
        error: function(data) {
            console.log(data);
        }
    })
}

function checkResetPassword() {
    if (document.cookie) {
        $.ajax({
            type: 'GET',
            headers: {'x-access-token': document.cookie},
            url: '/changepassword',
            success: function() {

            }
        })
    }
}

// React router that switches between signin, signup, and pet app

var MainRouter = () => (
   <Router history={browserHistory}>

     <Route path="/about" component={About}/>
     <Route path="/unranked" component={Unranked} />
    <Route path="/ranked" component={Ranked} onEnter={requireAuth}/>
    <Route path="/profile" component={ProfilePage} onEnter={requireAuth}/>
    <Route path="/mazebuilder" component={App} onEnter={requireAuth}/>
    <Route path="/multiplayer" component={MultiplayerMazeRunner} onEnter={requireAuth}/>
    <Route path="/multiplayerRanked" component={MultiplayerRanked} onEnter={requireAuth}/>
    <Route path="/multiplayerCustom" component={MultiplayerCustom} onEnter={requireAuth}/>
    <Route path="/mazestore" component={MazeStore} onEnter={requireAuth}/>
    <Route path="/singleplayer" component={MazeRunner} onEnter={requireAuth}/>
    <Route path="/resetpassword" component={ResetPassword} />
    <Route path="/" component={LandingPage} onEnter={checkAuth} />
  </Router>
);


ReactDOM.render(<MainRouter />, document.getElementById('app'));