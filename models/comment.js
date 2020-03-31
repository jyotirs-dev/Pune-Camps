var mongoose = require("mongoose");

var commentSchema = mongoose.Schema({
     text: String,
     rating: Number,
     created: { type: Date, default: Date.now },
     author: {
          id: {
               type: mongoose.Schema.Types.ObjectId,
               ref: "Users"
          },
          username: String

     }
});

module.exports = mongoose.model("Comment", commentSchema);
