const express = require("express");
const mongoose = require("mongoose");
const app = express();
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require('method-override');      //for using methods like PUT/DELETE/etc...
const ejsMate = require("ejs-mate");    // for creating templates/layouts
const wrapAsync = require("./utils/wrapAsync.js");  
const expressError = require("./utils/expressError.js");
let {listingSchema} = require("./schema.js");  
const Review = require("./models/review.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const userRouter = require("./routes/user.js");
const middleware = require("./middleware.js");

const sessionOptions = {
    secret: "mysupersecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,             // ---> for security purposes
    }
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());  
app.use(passport.session());      //to identify as they browse from page to page 
passport.use(new LocalStrategy(User.authenticate()));   // to use local strategy

passport.serializeUser(User.serializeUser());           /// to store information till session not end
passport.deserializeUser(User.deserializeUser());        // to remove info when session end

app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));

app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

/// LOCALS to use anywhere
app.use((req,res,next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.use("/",userRouter); 

main()
    .then(()=>{
    console.log("connected to db");
})
    .catch((err)=>{ 
        console.log(err);
});

async function main(){
    await mongoose.connect("mongodb://127.0.0.1:27017/Wonder");
};


app.get("/",(req,res)=>{
    res.send("Working");
});

// app.get("/demo", async(req,res) => {
    //     let fakerUser = new User({
        //         email: "student@gamil.com",
        //         username: "HasSstudents",
        //     });
        
        //     let newUser = await User.register(fakerUser, "HelloPassword");    // to identify the password is unique or not
        //     res.send(newUser);

        // });
        
        // Index Route
        app.get("/listings", wrapAsync(async (req,res)=>{
            
            const allLists = await Listing.find({});
            res.render("index.ejs",{allLists});
        }));

        // Search Route
        app.get("/listings/search", wrapAsync(async (req,res)=>{
            const query = req.query.q || "";
            const searchRegex = new RegExp(query, "i"); // 'i' flag for case-insensitive search
            
            const allLists = await Listing.find({
                $or: [
                    { title: searchRegex },
                    { location: searchRegex },
                    { description: searchRegex },
                    { country: searchRegex }
                ]
            });
            
            res.render("index.ejs", { allLists });
        }));
        
        // to add new
        app.get("/listings/new",middleware.isLoggedIn,(req,res)=>{
            
            res.render("new.ejs");
        });
        
        //Show Route
        app.get("/listings/:id", wrapAsync(async (req,res)=>{
            let {id} = req.params;
            const detail = await Listing.findById(id).populate("review");
            res.render("show.ejs", {detail});
        }));
        
        //create route
        app.post("/listings",middleware.isLoggedIn, wrapAsync(async (req,res)=>{
            let result = listingSchema.validate(req.body);
            if(result.error){
                throw new expressError(400,result.error);
            }
            const newListing = new Listing(req.body.listing);
            await newListing.save();
            
            req.flash("success","New listing created successfully");
            res.redirect("/listings"); 
        }));
        
        // Edit Route
        app.get("/listings/:id/edit",middleware.isLoggedIn,wrapAsync(async (req,res)=>{
    let {id} = req.params;
    const detail = await Listing.findById(id);
    res.render("edit.ejs",{detail});
}));

// update route
app.patch("/listings/:id",middleware.isLoggedIn, wrapAsync(async (req,res)=>{
    let {id} = req.params;
    await Listing.findByIdAndUpdate(id, {...req.body.listing});
    res.redirect(`/listings/${id}`);
}));

app.delete("/listings/:id", middleware.isLoggedIn, wrapAsync(async (req,res)=>{
    let {id} = req.params;
    await Listing.findByIdAndDelete(id, {...req.body.listing});
    res.redirect("/listings");
}));

// Review Route
app.post("/listings/:id/review", middleware.isLoggedIn, wrapAsync(async (req,res)=>{
    let {id} = req.params;
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review); 
    listing.review.push(newReview);
    
    await newReview.save();
    await listing.save();
    res.redirect(`/listings/${id}`);
}));











//if route not  found
app.all("*",(req,res,next) => {
    next(new expressError(404,"Page not found!"));
});

// use of middleware for any error
app.use((err,req,res,next) => {
    let {statusCode=500, message="Something went wrong!"} = err;
    res.render("error.ejs", {message});
    // res.status(statusCode).send(message); 
});


app.listen("8080",()=>{
    console.log("It is listening");
});