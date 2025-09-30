/**
 * logic of user manage:
 *  when the user try to visit user manage page,
 *  front-end should push different router
 *  accourding to whether the user get admin permission,
 *  and using different request API to get data.
 */
const express = require('express')
const router = express.Router()
const {db,genid} = require('../db/dbUtils');
const { decodeToken } = require('../utils/jwtHelper');

const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require("nodemailer");
const redis = require("redis")
const redisClient = require("../db/redis")
const ejs = require('ejs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const {encryptEmail, decryptEmail, emailIndexHash} = require('../utils/EmailCrypto')

router.post("/add",authMiddleware, async (req,res) => {
    let account = req.body.account ?? null ;
    let pwd     = req.body.pwd     ?? null ;
    let name    = req.body.name    ?? null ;
    let age     = req.body.age     ?? null ;
    let gender  = req.body.gender  ?? null ;
    let height  = req.body.height  ?? null ;
    let weight  = req.body.weight  ?? null ;
    pwd = crypto.createHash('sha256').update(pwd.toString()).digest('hex');

    const existAccountSql = "select * from `user` where `account` = ?;";
    const {err,rows} = await db.async.all(existAccountSql,[account]);
    if(err==null && rows.length === 0){
        const insertUserSql = "insert into `user` (`account`,`name`,`pwd`,`age`,`gender`,`height`,`weight`,`role`) values (?,?,?,?,?,?,?,?) ;";
        try{
            await db.async.run(insertUserSql,[account,name,pwd,age,gender,height,weight,1]);
            return res.status(200).json({
                code:200,
                msg:"添加成功"
            });
        }catch(e){
            console.log(e)
            return res.status(200).json({
                code:500,
                msg:"添加失败"
            });
        }
    }else if(rows.length > 0){
        return res.status(200).json({
            code:403,
            msg:"用户已存在"
        });
    }else {
        console.log(e)
        return res.status(200).json({
                code:500,
                msg:"添加失败"
        });
    }
});

router.post("/delete",authMiddleware,async (req,res) =>{
    const account = req.body.account;
    const delSql = "delete from `user` where `account` = ? ;";
    try{
        await db.async.run(delSql,[account]);
        return res.status(200).json({
            code:200,
            msg:"删除成功"
        });
    }catch(err){
        console.log(err)
        return res.status(500).json({
            code:500,
            msg:"服务器错误"
        });
    }
})

/**
 * @api {get} /user/list Get User List
 * @apiGroup User
 * 
 * @apiHeader {String} Authorization Bearer Token
 *
 * @apiQuery {Number} [page=1] Page number (starting from 1).
 * @apiQuery {Number} [limit=20] Number of items per page.
 * 
 * @apiSuccess {Object} Response:
 * {
 *   "code": 200,
 *   "msg": "Success",
 *   "rows": [
 *     {
 *       "account": "user001",
 *       "role": "2",
 *       "name": "Alice",
 *       "gender": "Female",
 *       "age": 25
 *     },
 *     // ... more users
 *   ]
 * }
 */
router.get("/list", authMiddleware, async (req,res)=>{
    const role = req.role;
    if(role < 3){
        return res.status(200).json({
            code:403,
            msg:"您无权限访问"
        })
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const searchSQL = "select * from `user` order by `account` limit ? offset ? ;"
    const {err,rows} = await db.async.all(searchSQL,[limit,offset]);
    const {err:countErr,rows:Countrows} = await db.async.all("select count(*) as cnt from `user`;",[]);
    if(err!=null){
        return res.status(500).json({
            code:500,
            msg:"服务器错误"
        })
    }else{
        return res.status(200).json({
            code:200,
            rows,
            count:Countrows[0].cnt
        })
    }
});

/**
 * @api {get} /user/selfinfo Get Current User Info
 * @apiGroup User
 * 
 * @apiHeader {String} Authorization Bearer Token
 * 
 * @apiSuccess {Object} Response Example:
 * {
 *   "code": 200,
 *   "rows": [
 *     {
 *       "account": "user001",
 *       "role": "2",
 *       "name": "Alice",
 *       "gender": "Female",
 *       "age": 25
 *     }
 *   ]
 * }
 * 
 */
router.get("/selfinfo", authMiddleware, async (req,res)=>{
    const account = req.account;
    const searchSQL = "select * from `user` where account = ? ;"
    const {err,rows} = await db.async.all(searchSQL,[account]);
    
    if(err == null && rows.length > 0){
        rows[0].email = decryptEmail(rows[0].email_enc);
        return res.status(200).json({
            code:200,
            rows
        });
    }else if(rows.length == 0){
        return res.status(200).json({
            code:200,
            msg:"无该用户"
        });
    }else{
        return res.status(500).json({
            code:200,
            msg:"服务器错误"
        });
    }
});

/**
 * @api {get} /user/info Get User Info by Account
 * @apiGroup User
 * 
 * @apiQuery {String} account User account to query.
 * 
 * @apiSuccess {Object} Response Example:
 * {
 *   "code": 200,
 *   "rows": [
 *     {
 *       "account": "user001",
 *       "role": "2",
 *       "name": "Alice",
 *       "gender": "Female",
 *       "age": 25
 *     }
 *   ]
 * }
 */
router.get("/info",authMiddleware,async (req,res) => {
    const account = req.query.account;
    const searchSQL = "select * from `user` where account = ? ;"
    const {err,rows} = await db.async.all(searchSQL,[account]);
    if(err == null && rows.length > 0){
        rows[0].email = decryptEmail(rows[0].email_enc);
        return res.status(200).json({
            code:200,
            rows
        });
    }else if(rows.length == 0){
        return res.status(200).json({
            code:200,
            msg:"无该用户"
        });
    }else{
        return res.status(500).json({
            code:200,
            msg:"服务器错误"
        });
    }
})

/**
 * @api {post} /user/change Update Current User Info
 * @apiGroup User
 * 
 * @apiHeader {String} Authorization Bearer Token
 * 
 * @apiBody {String} [name] User name.
 * @apiBody {Number} [age] User age.
 * @apiBody {String} [gender] User gender.
 * @apiBody {Number} [height] User height.
 * @apiBody {Number} [weight] User weight.
 * @apiBody {String} [email] User email (must be valid format).
 * 
 * @apiSuccess {Object} Response Example (Success):
 * {
 *   "code": 200,
 *   "msg": "Update successful"
 * }
 */
router.post("/change", authMiddleware, async (req,res) => {
    // Judge who the request is changing firstly,
    // get it role just when the request is trying to change others' info.
    const account = req.account;
    const role = req.role;
    const changeAccount = req.body.account;
    const searchSQL = "select * from `user` where `account` = ? ;"
    const {err,rows} = await db.async.all(searchSQL,[changeAccount]);

    if(err == null && rows.length > 0){
        if(role < 3 && changeAccount != account){
            return res.status(200).json({
                code:401,
                msg:"Unauthorized"
            });
        }
        let {name,age,gender,height,weight} = rows[0];
        
        name   = req.body.name   ?? name   ;
        age    = req.body.age    ?? age    ;
        gender = req.body.gender ?? gender ;
        height = req.body.height ?? height ;
        weight = req.body.weight ?? weight ;

        const updateSQL = "update `user` set name = ?, age = ?, gender = ?, height = ?, weight = ? where account = ? ;"
        try{
            await db.async.run(updateSQL,[name,age,gender,height,weight,changeAccount]);
            return res.status(200).json({
                code:200,
                msg:"修改成功"
            })
        }catch(e){
            return res.status(200).json({
                code:500,
                msg:"修改失败"
            })
        }
    }else{
        return res.status(200).json({
            code:404,
            msg:"未找到该用户"
        })
    } 
});

/**
 * @api {post} /setEmail Set email and send verification mail
 * @apiGroup User
 *
 * @apiHeader {String} Authorization Bearer Token
 *
 * @apiBody {String} email User email to be bound.
 *
 * @apiSuccess {json} 200 Response example:
 * {
 *   "code": 200,
 *   "msg": "Email has been sent"
 * }
 */
router.post("/setEmail",authMiddleware,async (req,res) => {
    console.log(req.body)
    const account = req.account;
    const email = req.body.email;
    if(!emailRegex.test(email)){
        return res.status(200).json({
            code:422,//unprocessable entity
            msg:"邮箱格式不合法"
        });
    }
    
    const emailHash = emailIndexHash(email)
    const {payload, keyVersion} = encryptEmail(email);

    const verifyCode = crypto.randomBytes(16).toString("hex");
    const expiresAt = 60 * 30; // 秒为单位

    const userData = JSON.stringify({
        account,
        email_enc: payload,
        email_hash: emailHash,
        keyVersion
    });

    // store to Redis (set exprie time as 30 minutes)
    await redisClient.setEx(`setEmail:${verifyCode}`, expiresAt, userData);

    // send email from 163
    const transporter = nodemailer.createTransport({
    service: '163',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
    });

    const verifyUrl = `http://localhost:3000/user/verify?code=${verifyCode}`;
    const templatePath = path.join(__dirname, '../views/emailTemplate.ejs');

    const htmlContent = await ejs.renderFile(templatePath, { verifyUrl });
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: '邮箱验证 - 请前往你的邮箱进行确认',
        html:htmlContent
    });
    res.status(200).send({
        code:200,
        msg:"已发送邮件"
    })
});

/**
 * @api {post} /user/reset/pwd Request Password Reset
 * @apiGroup User
 * 
 * @apiHeader {String} Authorization Bearer Token
 * 
 * @apiBody {String} newPassword New password (required).
 * 
 * @apiSuccess {Object} Response Example (Success):
 * {
 *   "code": 200,
 *   "msg": "Password reset verification email sent, please check your inbox"
 * }
 */
router.post('/reset/pwd',authMiddleware, async (req, res) => {
    const account = req.account;
    const searchSQL = "select `email_enc` from `user` where `account` = ? ;"
    const {err,rows} = await db.async.all(searchSQL,[account]);
    let emailEnc = rows[0].email_enc;
    if(emailEnc == null){
        return res.status(200).json({
            code:412,//pre condition failed
            msg:"请先设置邮箱内容"
        });     
    }else if(rows.length == 0){
        return res.status(200).json({
            code:404,
            msg:"无该用户"
        })
    }else if(err != null){
        return res.status(500).json({
            code:500,
            msg:"服务器错误"
        })
    }

    const email = decryptEmail(emailEnc); 
    console.log(email)
    if(!emailRegex.test(email)){
        return res.status(200).json({
            code:422,//unprocessable entity
            msg:"邮箱格式不合法"
        });
    }
    
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(200).json({ 
            code: 400, 
            msg: "密码不能为空" 
        });
    }

    // genearte verify code and hash password
    const verifyCode = crypto.randomBytes(16).toString("hex");
    const expiresAt = 60 * 30; //(expires at 30 minutes)

    const hash = crypto.createHash('sha256');
    hash.update(newPassword);
    const hashedPassword = hash.digest('hex');

    try{
        // store verify code and hashed password to redis
        await redisClient.setEx(
            `reset-password:${verifyCode}`, 
            expiresAt, 
            JSON.stringify({ account, newPassword: hashedPassword })
        );

        // send email
        const transporter = nodemailer.createTransport({
            service: '163',
            auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
            }
        });

        const resetUrl = `http://localhost:3000/user/verifyReset?code=${verifyCode}`;

        const templatePath = path.join(__dirname, '../views/resetPwdEmail.ejs');
        const htmlContent = await ejs.renderFile(templatePath, { resetUrl });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: '密码重置确认',
            html: htmlContent
        });

        return res.status(200).send({ 
            code: 200, 
            msg: "重置验证邮件已发送，请查收邮箱" 
        });
    }catch(err){
        return res.status(500).json({
            code:500,
            msg:err.msg
        })
    }
});

/**
 * @api {post} /authorization Update user role
 * @apiGroup User
 *
 * @apiHeader {String} Authorization Bearer Token
 *
 * @apiBody {String} account The account of the user to be authorized.
 * @apiBody {Number} role New role level for the user.
 *
 * @apiSuccess {json} 200 Response example:
 * {
 *   "code": 200,
 *   "msg": "Role updated successfully"
 * }
 */
router.post('/authorization',authMiddleware ,async (req,res) => { 
    console.log(req.body)
    const authUser = req.body.authUser;
    const roleLevel = Number(req.body.roleLevel);

    if((req.role < 3) || (req.role < 4 && roleLevel > 2)){
        return res.status(200).json({
            code:403,
            msg:"您无权限进行此授权操作"
        })
    }
    try{
        const authSQL = "update `user` set `role` = ? where `account` = ? ;"
        await db.async.run(authSQL,[roleLevel,authUser])
        return res.status(200).json({
                code:200,
                msg:"修改成功"
        })
    }catch(e){
        console.log(e)
        return res.status(200).json({
            code:500,
            msg:"修改失败"
        })
    }
})

/**
 * @api {get} /verify Verify email
 * @apiGroup User
 *
 * @apiQuery {String} code Verification code received by email.
 *
 * @apiSuccess {json} 200 Response example (rendered as HTML in practice):
 * {
 *   "account": "testUser",
 *   "email": "user@\example.com"
 * }
 */
router.get('/verify', async (req, res) => {
  const { code } = req.query;

  const json = await redisClient.get(`setEmail:${code}`);
  if (!json) {
    return res.status(500).render('verifyEmailFailed');
  }else{
    const { account, email_enc, email_hash, keyVersion } = JSON.parse(json);

    // insert into info of user
    await db.async.run(
      "update `user` set `email_enc` = ?, `email_hash` = ?, `key_version` = ? where `account` = ? ;",
      [email_enc, email_hash, keyVersion, account]
    );

    await redisClient.del(`setEmail:${code}`);

    const decryptedEmail = decryptEmail(email_enc)
    res.status(200).render('verifyEmailSuccess',{ account, email: decryptedEmail });
  }
});

/**
 * @api {get} /verifyReset Verify password reset
 * @apiGroup User
 *
 * @apiQuery {String} code Verification code received by email.
 *
 * @apiSuccess {json} 200 Response example (rendered as HTML in practice):
 * {
 *   "msg": "Password has been reset successfully"
 * }
 *
 * @apiError (400) InvalidLink The verification link is invalid or expired.
 * @apiError (500) ServerError Failed to reset password.
 */
router.get('/verifyReset', async (req, res) => {
  const { code } = req.query;

  try {
    const data = await redisClient.get(`reset-password:${code}`);
    if (!data) {
      return res.send("链接无效或已过期！");
    }

    const { account, newPassword } = JSON.parse(data);

    await db.async.run(
      "UPDATE `user` SET `pwd` = ? WHERE `account` = ?",
      [newPassword, account]
    );

    await redisClient.del(`reset-password:${code}`);

    return res.status(200).render("resetPwdSuccess");

  } catch (e) {
    return res.status(500).render("resetPwdFailed");
  }
});

module.exports = router